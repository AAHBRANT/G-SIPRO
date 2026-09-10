import { NextResponse } from "next/server";
import { z } from "zod";

import type { AuthorizationContext } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { EditalReadingService } from "@/modules/scouting/application/edital-reading-service";
import { ScoutService } from "@/modules/scouting/application/scout-service";
import { PdfjsTextExtraction } from "@/modules/scouting/infrastructure/pdf-text";
import { PncpClient } from "@/modules/scouting/infrastructure/pncp-client";
import { PncpFilesClient } from "@/modules/scouting/infrastructure/pncp-files-client";
import {
  PrismaEditalExtraction,
  PrismaEditalReadingRepository,
} from "@/modules/scouting/infrastructure/prisma-edital-reading";
import { PrismaScoutRepository } from "@/modules/scouting/infrastructure/prisma-scouting-repository";
import { requireScoutDispatcher } from "@/modules/scouting/infrastructure/scout-dispatch-auth";

const commandSchema = z.object({
  trigger: z.enum(["SCHEDULED", "MANUAL"]).default("SCHEDULED"),
  /**
   * Recorte opcional de unidades federativas. Permite ao agendador varrer o país
   * em lotes, mantendo cada requisição curta o bastante para não ser encerrada
   * pelo balanceador. Sem recorte, valem os estados configurados nos filtros.
   */
  states: z.array(z.string().trim().toUpperCase().length(2)).max(27).optional(),
}).strict();

/**
 * Janela consultada: certames que encerram nos próximos 12 meses. Horizontes
 * mais largos alargam demais o resultado e fazem o portal estourar o tempo
 * limite — comportamento verificado contra o serviço real.
 */
const HORIZON_MONTHS = 12;

/**
 * Dispara a varredura semanal do Buscador. Chamada pelo agendador (domingo),
 * autenticada por token dedicado — não por sessão de usuário.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      requireScoutDispatcher(request);
      const command = commandSchema.parse(await request.json().catch(() => ({})));

      const repository = new PrismaScoutRepository();
      const filter = await repository.loadFilter();
      const finalDate = new Date();
      finalDate.setMonth(finalDate.getMonth() + HORIZON_MONTHS);

      // O lote pedido pelo agendador é cruzado com os estados configurados pela
      // equipe: se ela restringiu a atuação, nenhum estado fora disso chega a
      // ser consultado. Sem restrição, o lote vale integralmente.
      const configured = filter?.states ?? [];
      const requested = command.states;
      const states = requested && configured.length > 0
        ? requested.filter((state) => configured.includes(state))
        : requested ?? configured;

      // Lote inteiramente fora da área de atuação: nada a consultar.
      if (requested && configured.length > 0 && states.length === 0) {
        return NextResponse.json({ data: { skipped: true, reason: "Lote fora dos estados configurados." }, correlationId: context.correlationId });
      }

      const source = new PncpClient({ finalDate, states });
      const data = await new ScoutService(repository, source).run(command.trigger);

      // Nenhuma licitação nova fica "a conferir" à toa esperando um clique
      // que não existe: lê o edital de cada uma, por casamento de padrão,
      // ainda dentro desta mesma requisição.
      await readEditaisDaVarredura(data.runId, context.correlationId);

      return NextResponse.json({ data, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}

/**
 * Lê o edital de cada licitação nova desta varredura — sem IA, sem sessão de
 * usuário (`readById` fica nulo: é a própria varredura, não uma pessoa).
 *
 * Nunca deixa uma licitação ruim (PDF ilegível, PNCP fora do ar) derrubar as
 * outras: cada falha só significa que aquela continua "a conferir", e seguem
 * as próximas. Quem quiser tentar de novo manualmente tem o botão "Reler
 * edital" — este disparo automático não repete numa varredura futura, porque
 * só olha o `runId` de agora.
 */
async function readEditaisDaVarredura(runId: string, correlationId: string): Promise<void> {
  const pendentes = await getDatabase().scoutedTender.findMany({
    where: { runId, editalReading: null },
    select: { id: true },
  });
  if (pendentes.length === 0) return;

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

  for (const tender of pendentes) {
    try {
      await service.read(tender.id, auth, correlationId, false, true);
    } catch {
      // Ver o comentário da função: uma licitação ruim não pode custar as
      // outras. Fica "a conferir" e a varredura segue.
    }
  }
}
