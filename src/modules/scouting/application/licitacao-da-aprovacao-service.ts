/**
 * Cria a ficha da LICITAÇÃO logo depois que a triagem aprova.
 *
 * Roda em segundo plano, por decisão do dono em 22/09/2026: aprovar continua
 * instantâneo, e a ficha aparece completa alguns segundos depois. Baixar de 10
 * a 20 MB com a tela parada seria pagar caro por uma espera que ninguém pediu.
 *
 * ⚠️ Os bytes são DESCARTADOS depois de conferidos. Baixar aqui não é para
 * guardar arquivo — é para calcular o SHA-256 e o tamanho de cada documento,
 * que é o que a ficha registra junto com o endereço no portal. O hash é o que
 * denuncia edital retificado depois da aprovação, quando o link continua igual
 * e o conteúdo mudou.
 *
 * ⚠️ Falhar aqui NÃO desfaz a aprovação. A oportunidade já existe e é o que
 * sustenta o trabalho da equipe; a ficha da licitação é complemento. Por isso
 * cada saída sem sucesso é registrada com motivo, em vez de propagar erro para
 * uma requisição que já respondeu ao usuário.
 */
import { createHash } from "node:crypto";

import { getDatabase } from "@/core/database/prisma";
import { createLogger } from "@/core/observability/logger";
import { getEnvironment } from "@/core/config/env";
import {
  montarRascunho,
  type ArquivoConferido,
} from "@/modules/scouting/domain/licitacao-da-aprovacao";
import { parsePncpIdentifier } from "@/modules/scouting/domain/pncp-identifier";
import { requisitosDoEdital } from "@/modules/scouting/domain/requisitos-do-edital";
import { PrismaEditalReadingRepository } from "@/modules/scouting/infrastructure/prisma-edital-reading";
import { RequirementService } from "@/modules/requirements/application/requirement-service";
import { PrismaRequirementRepository } from "@/modules/requirements/infrastructure/prisma-requirement-repository";
import { PncpFilesClient, type TenderFile } from "@/modules/scouting/infrastructure/pncp-files-client";
import { TenderService } from "@/modules/tenders/application/tender-service";
import { PrismaTenderRepository } from "@/modules/tenders/infrastructure/prisma-tender-repository";

/** Tudo o que o órgão publicou, pesado e conferido, sem guardar os bytes. */
async function conferirArquivos(
  cliente: PncpFilesClient,
  arquivos: readonly TenderFile[],
  aoIgnorar: (titulo: string, motivo: string) => void,
): Promise<ArquivoConferido[]> {
  const conferidos: ArquivoConferido[] = [];
  for (const arquivo of arquivos) {
    try {
      const baixado = await cliente.download(arquivo);
      if (!baixado) {
        aoIgnorar(arquivo.title, "maior que o limite por arquivo");
        continue;
      }
      conferidos.push({
        titulo: arquivo.title,
        documentType: arquivo.documentType,
        fileName: baixado.filename,
        fileHash: createHash("sha256").update(baixado.bytes).digest("hex"),
        uri: arquivo.url,
        mimeType: baixado.mimeType,
        sizeBytes: baixado.bytes.byteLength,
      });
    } catch (erro) {
      aoIgnorar(arquivo.title, erro instanceof Error ? erro.message : "erro desconhecido");
    }
  }
  return conferidos;
}

/**
 * Transporta a leitura do edital para os requisitos da ficha.
 *
 * Sem leitura ainda, não há o que transportar — e isso é comum: a licitação
 * pode ser aprovada antes de o represado alcançá-la. Os requisitos nascem em
 * rascunho, para conferência humana; ver `requisitos-do-edital`.
 *
 * Um requisito que não entra não derruba os outros nem a ficha: a exigência
 * perdida vira linha de log, e a equipe ainda tem a licitação montada.
 */
async function registrarRequisitos(
  tenderId: string,
  scoutedTenderId: string,
  actorId: string,
  correlationId: string,
): Promise<number> {
  const logger = createLogger(getEnvironment());
  const leitura = await new PrismaEditalReadingRepository().find(scoutedTenderId);
  if (!leitura) return 0;

  const versao = await getDatabase().tenderVersion.findFirst({
    where: { tenderId },
    orderBy: { version: "desc" },
    select: { id: true },
  });
  if (!versao) return 0;

  const servico = new RequirementService(new PrismaRequirementRepository());
  let gravados = 0;
  for (const requisito of requisitosDoEdital(leitura.requirement, versao.id, actorId)) {
    try {
      await servico.create(requisito, actorId, correlationId);
      gravados += 1;
    } catch (erro) {
      logger.warn({ tenderId, correlationId, texto: requisito.text.slice(0, 120), erro: erro instanceof Error ? erro.message : String(erro) },
        "Requisito do edital não pôde ser registrado na ficha.");
    }
  }
  return gravados;
}

export async function montarLicitacaoDaAprovacao(
  scoutedTenderId: string,
  opportunityId: string,
  actorId: string,
  correlationId: string,
  cliente: PncpFilesClient = new PncpFilesClient(),
): Promise<void> {
  const logger = createLogger(getEnvironment());
  const base = { scoutedTenderId, opportunityId, correlationId };
  try {
    const fila = await getDatabase().scoutedTender.findUnique({
      where: { id: scoutedTenderId },
      select: { externalId: true, subject: true, modality: true, processNumber: true, noticeUrl: true },
    });
    if (!fila) return void logger.warn(base, "Licitação sumiu da fila antes de montar a ficha.");

    const identificador = parsePncpIdentifier(fila.externalId);
    if (!identificador) {
      return void logger.warn({ ...base, externalId: fila.externalId },
        "Identificador fora do padrão do PNCP: ficha da licitação não foi criada.");
    }

    // O órgão vem da oportunidade, que a aprovação acabou de vincular (ou de
    // cadastrar). Repetir a busca aqui daria chance de divergir das duas.
    const oportunidade = await getDatabase().opportunity.findUnique({
      where: { id: opportunityId },
      select: { contractingAuthorityId: true },
    });

    const publicados = await cliente.list(identificador.authorityDocument, identificador.year, identificador.sequence);
    if (publicados.length === 0) {
      return void logger.warn(base, "Órgão não publicou arquivo no PNCP: ficha da licitação não foi criada.");
    }

    const ignorados: string[] = [];
    const conferidos = await conferirArquivos(cliente, publicados, (titulo, motivo) => ignorados.push(`${titulo}: ${motivo}`));
    if (conferidos.length === 0) {
      return void logger.warn({ ...base, publicados: publicados.length, ignorados },
        "Nenhum arquivo do PNCP pôde ser conferido: ficha da licitação não foi criada.");
    }

    const rascunho = montarRascunho(
      {
        externalId: fila.externalId,
        subject: fila.subject,
        modality: fila.modality,
        ...(fila.processNumber ? { processNumber: fila.processNumber } : {}),
        ...(fila.noticeUrl ? { noticeUrl: fila.noticeUrl } : {}),
        opportunityId,
        ...(oportunidade?.contractingAuthorityId ? { contractingAuthorityId: oportunidade.contractingAuthorityId } : {}),
      },
      identificador,
      conferidos,
      new Date(),
    );

    const criada = await new TenderService(new PrismaTenderRepository()).create(rascunho, actorId, correlationId);
    const requisitos = await registrarRequisitos(criada.id, scoutedTenderId, actorId, correlationId);
    logger.info({
      ...base,
      tenderId: criada.id,
      code: criada.code,
      publicados: publicados.length,
      vinculados: conferidos.length,
      ignorados: ignorados.length,
      requisitos,
    }, "Ficha da licitação criada a partir da aprovação.");
  } catch (erro) {
    // Já existe ficha para esta licitação (aprovação repetida, corrida entre
    // duas pessoas) cai aqui pelo código único e não é motivo de alarme.
    logger.error({ ...base, erro: erro instanceof Error ? erro.message : String(erro) },
      "Não foi possível montar a ficha da licitação depois da aprovação.");
  }
}
