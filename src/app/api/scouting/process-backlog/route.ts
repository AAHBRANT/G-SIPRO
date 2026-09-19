import { NextResponse } from "next/server";

import type { AuthorizationContext } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { EditalReadingService } from "@/modules/scouting/application/edital-reading-service";
import { TriageService } from "@/modules/scouting/application/triage-service";
import { resolveDuplicates } from "@/modules/scouting/domain/duplicates";
import { PdfjsTextExtraction } from "@/modules/scouting/infrastructure/pdf-text";
import { PncpFilesClient } from "@/modules/scouting/infrastructure/pncp-files-client";
import {
  PrismaEditalExtraction,
  PrismaEditalReadingRepository,
} from "@/modules/scouting/infrastructure/prisma-edital-reading";
import { OpportunityFromScoutedTender, PrismaTriageRepository } from "@/modules/scouting/infrastructure/prisma-scouting-repository";
import { requireScoutDispatcher } from "@/modules/scouting/infrastructure/scout-dispatch-auth";

/**
 * Resolve o que a varredura de captação deixa pendente: duplicata a
 * descartar e edital a ler — em uma chamada À PARTE, nunca dentro da mesma
 * requisição que busca no PNCP.
 *
 * ⚠️ Isto já morou dentro de `/api/scouting/scan`, e foi tirado de lá depois
 * de uma falha real: o ingress do Container App corta a conexão perto dos
 * 240 s (achado rodando contra o ambiente de verdade, 11/09/2026 — os 6 lotes
 * da varredura voltaram 504 em sequência, com o mesmo intervalo entre cada
 * um). A busca no PNCP sozinha já usa boa parte desse tempo; somar leitura
 * de edital (rede + PDF, por licitação) e resolução de duplicata na mesma
 * requisição estourava o teto quase sempre que havia mais que um punhado de
 * pendências. Rota própria, orçamento próprio, disparo próprio.
 *
 * Chamada pelo mesmo workflow da varredura, como um passo separado — ver
 * `.github/workflows/buscador-scan.yml`.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      requireScoutDispatcher(request);

      const deadline = Date.now() + BUDGET_MS;
      const duplicatas = await descartarDuplicatas();
      const editais = await readEditaisDaVarredura(context.correlationId, deadline);

      return NextResponse.json({ data: { duplicatas, editais }, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}

/**
 * Orçamento total desta chamada. Bem abaixo do teto observado do ingress
 * (~240 s): a busca no PNCP roda numa chamada separada e já usa parte do seu
 * próprio teto, então esta rota não precisa disputar o mesmo relógio — mas
 * ainda assim tem o dela, porque leitura de edital é rede por licitação e
 * cresce sem aviso conforme o represado for grande.
 */
const BUDGET_MS = 150_000;

/**
 * Descarta quem é a mesma obra publicada mais de uma vez, mantendo só a
 * publicação mais recente na fila — decisão do usuário: duplicata não é
 * mais só sinalizada, é excluída de verdade.
 *
 * Só olha quem ainda está PENDING: uma duplicata que alguém já decidiu
 * (aprovou ou descartou por conta própria) nunca é tocada por aqui —
 * `TriageService.discard()` já recusa quem não está mais pendente.
 * `actorId` ausente: é a própria varredura, não uma pessoa: `decidedById`
 * fica nulo e o motivo registrado explica que foi automático.
 *
 * Sem orçamento de tempo próprio: é leitura + escrita de banco, sem rede
 * externa nenhuma — mesmo com toda a fila pendente, é ordens de grandeza
 * mais rápido que uma única leitura de edital.
 */
async function descartarDuplicatas(): Promise<{ descartadas: number }> {
  const pendentes = await getDatabase().scoutedTender.findMany({
    where: { status: "PENDING" },
    select: {
      id: true, authorityDocument: true, authorityName: true, processNumber: true,
      subject: true, proposalOpensAt: true, createdAt: true,
    },
  });
  if (pendentes.length < 2) return { descartadas: 0 };

  const perdedores = resolveDuplicates(pendentes.map((tender) => ({
    id: tender.id,
    ...(tender.authorityDocument ? { authorityDocument: tender.authorityDocument } : {}),
    authorityName: tender.authorityName,
    ...(tender.processNumber ? { processNumber: tender.processNumber } : {}),
    subject: tender.subject,
    ...(tender.proposalOpensAt ? { publishedAt: tender.proposalOpensAt } : {}),
    createdAt: tender.createdAt,
  })));
  if (perdedores.size === 0) return { descartadas: 0 };

  const service = new TriageService(new PrismaTriageRepository(), new OpportunityFromScoutedTender());
  let descartadas = 0;
  for (const [perdedorId, sobreviventeId] of perdedores) {
    try {
      await service.discard(perdedorId, undefined, `Duplicata automática: mesma obra que a licitação ${sobreviventeId}, publicada mais recentemente.`);
      descartadas += 1;
    } catch {
      // Corrida rara: alguém decidiu esta licitação entre a consulta acima e
      // agora. TriageService.discard() já recusa quem não está mais
      // PENDING — a decisão da pessoa vale, a automação só desiste desta.
    }
  }
  return { descartadas };
}

/**
 * Teto de quantas licitações sem leitura esta chamada TENTA ler. É só um
 * limite superior de segurança contra uma consulta gigante — quem realmente
 * corta o trabalho no meio é `deadline`, checado antes de cada item.
 */
const LOTE_LEITURA_AUTOMATICA = 80;

/**
 * Lê o edital de quem ainda não tem leitura — sem IA, sem sessão de usuário
 * (`readById` fica nulo: é a própria varredura, não uma pessoa).
 *
 * Cobre tanto licitações recém-captadas quanto o represado antigo, pela
 * mesma fila e na mesma ordem: prazo mais próximo primeiro. Para ANTES do
 * `deadline` — nunca no meio de uma leitura em andamento, só entre uma
 * licitação e a próxima — deixando o resto para a chamada seguinte. Sem
 * isto, o texto que a tela já mostrava desde 04/09 ("a próxima chamada do
 * agendador cobre a fila pendente por ordem de prazo") vale integralmente:
 * o que não coube nesta chamada é coberto na próxima.
 *
 * Nunca deixa uma licitação ruim (PDF ilegível, PNCP fora do ar) derrubar as
 * outras: cada falha só significa que aquela continua "a conferir", e seguem
 * as próximas.
 *
 * ⚠️ `lidas` só conta `status === "READ"` — achado em produção (19/09/2026):
 * a versão anterior somava QUALQUER chamada que não lançasse exceção, e
 * `EditalReadingService.read()` devolve um status sem lançar exceção nos
 * casos "não deu para ler" (`NO_FILE`, `FILE_TOO_LARGE`, `NOTHING_EXTRACTED`,
 * `NO_IDENTIFIER`, `FAILED`) — nenhum deles grava leitura nenhuma. O número
 * relatado (milhares de "lidas") não batia com o que a tela mostrava
 * (licitação de alto valor, mesmo prazo, "edital não lido" depois de três
 * rodadas inteiras) porque a métrica contava tentativa, não sucesso.
 * `porStatus` fica para dizer O QUE está impedindo quem continua sem
 * leitura, em vez de um número só que não distingue as duas coisas.
 */
async function readEditaisDaVarredura(
  correlationId: string,
  deadline: number,
): Promise<{ lidas: number; total: number; porStatus: Record<string, number> }> {
  const pendentes = await getDatabase().scoutedTender.findMany({
    where: { status: "PENDING", editalReading: null },
    // "nulls: last" — sem prazo informado não é "mais urgente que todos": o
    // padrão do Postgres para ASC é nulo primeiro, o que faria justamente o
    // que não tem prazo nenhum furar a fila à frente de quem tem prazo apertado.
    orderBy: { proposalClosesAt: { sort: "asc", nulls: "last" } },
    take: LOTE_LEITURA_AUTOMATICA,
    select: { id: true },
  });
  if (pendentes.length === 0) return { lidas: 0, total: 0, porStatus: {} };

  const service = new EditalReadingService(
    new PncpFilesClient(),
    new PrismaEditalExtraction(),
    new PrismaEditalReadingRepository(),
    new PdfjsTextExtraction(),
  );
  // Sem sessão de usuário: nenhuma permissão é checada aqui dentro (a
  // governança de IA nem se aplica — `onlyPatternMatch` nunca chama IA), e
  // `readById` sai nulo por causa do actorId vazio ser descartado no serviço.
  const auth: AuthorizationContext = { actorId: "", permissions: new Set() };

  let lidas = 0;
  const porStatus: Record<string, number> = {};
  for (const tender of pendentes) {
    if (Date.now() >= deadline) break;
    try {
      const resultado = await service.read(tender.id, auth, correlationId, false, true);
      porStatus[resultado.status] = (porStatus[resultado.status] ?? 0) + 1;
      if (resultado.status === "READ") lidas += 1;
    } catch {
      // Ver o comentário da função: uma licitação ruim não pode custar as
      // outras. Fica "a conferir" e a varredura segue.
      porStatus.EXCEPTION = (porStatus.EXCEPTION ?? 0) + 1;
    }
  }
  return { lidas, total: pendentes.length, porStatus };
}
