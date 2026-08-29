/**
 * Adaptadores da leitura de edital: extração de IA e banco.
 *
 * Aqui mora o que encosta em infraestrutura. As regras — o que impede a
 * leitura, quando não vale reler, o que não pode virar leitura gravada — ficam
 * em `edital-reading-service.ts`, testadas sem banco nem rede.
 *
 * Não há adaptador de acervo documental: o PDF do edital não é preservado. O
 * que liga a leitura à sua fonte é a execução de IA (modelo, prompt, trechos
 * citados) mais o endereço e o SHA-256 dos bytes que o modelo recebeu.
 */
import { randomUUID } from "node:crypto";

import type { AuthorizationContext } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import { AiExtractionService } from "@/modules/ai-extraction/application/ai-extraction-service";
import { OpenAiResponsesProvider } from "@/modules/ai-extraction/infrastructure/openai-responses-provider";
import { PrismaAiExtractionRepository } from "@/modules/ai-extraction/infrastructure/prisma-ai-extraction-repository";
import type {
  EditalExtractionPort,
  EditalReadingRepository,
  EditalSource,
  StoredEditalReading,
} from "@/modules/scouting/application/edital-reading-service";
import type { EditalRequirement, RequiredService } from "@/modules/scouting/domain/edital-requirement";

export class PrismaEditalExtraction implements EditalExtractionPort {
  private readonly service = new AiExtractionService(new PrismaAiExtractionRepository(), new OpenAiResponsesProvider());

  /**
   * Caso de uso vigente, aprovado, com modelo ativo e este tipo documental
   * entre as fontes autorizadas. Os quatro filtros são o que a governança
   * exige; faltando um, a leitura simplesmente não acontece.
   */
  async approvedDefinition(documentType: string) {
    const definitions = await getDatabase().aiUseCaseDefinition.findMany({
      where: { approval: { isNot: null }, modelVersion: { status: "ACTIVE" }, nextVersions: { none: {} } },
      select: { id: true, promptHash: true, authorizedSources: true },
      orderBy: { version: "desc" },
    });
    const found = definitions.find((definition) =>
      Array.isArray(definition.authorizedSources)
      && (definition.authorizedSources as Array<{ documentType?: unknown }>).some((source) => source.documentType === documentType));
    return found ? { id: found.id, promptHash: found.promptHash } : undefined;
  }

  async runEphemeral(
    input: Readonly<{
      idempotencyKey: string;
      definitionId: string;
      requestedFields: readonly string[];
      source: Readonly<{ uri: string; filename: string; mimeType: string; documentType: string; title: string }>;
      bytes: Buffer;
    }>,
    auth: AuthorizationContext,
    correlationId: string,
  ) {
    const { bytes, ...pedido } = input;
    return this.service.executeEphemeral(
      { ...pedido, requestedFields: [...pedido.requestedFields] },
      bytes,
      auth,
      correlationId,
    );
  }
}

export class PrismaEditalReadingRepository implements EditalReadingRepository {
  async tender(tenderId: string) {
    const found = await getDatabase().scoutedTender.findUnique({
      where: { id: tenderId },
      select: { id: true, externalId: true, subject: true },
    });
    // O objeto da licitação faz as vezes de título do documento lido — o
    // serviço corta no limite da coluna.
    return found ? { id: found.id, externalId: found.externalId, title: found.subject } : undefined;
  }

  async find(tenderId: string) {
    const found = await getDatabase().scoutedTenderEditalReading.findUnique({ where: { tenderId } });
    return found ? editalReadingFromRow(found) : undefined;
  }

  async save(
    input: Readonly<{ tenderId: string; executionId: string; source: EditalSource; requirement: EditalRequirement }>,
    actorId: string,
    correlationId: string,
  ) {
    const dados = {
      executionId: input.executionId,
      sourceUri: input.source.uri,
      sourceFilename: input.source.filename,
      sourceFileHash: input.source.fileHash,
      sourceFetchedAt: input.source.fetchedAt,
      services: input.requirement.services as unknown as object,
      consortiumAllowed: input.requirement.consortiumAllowed ?? null,
      requiresCat: input.requirement.requiresCat ?? null,
      requiresSiteVisit: input.requirement.requiresSiteVisit ?? null,
      confidence: input.requirement.confidence ?? null,
      limitations: input.requirement.limitations as unknown as object,
      readById: actorId,
      // Reler zera a conferência: quem validou a leitura anterior não validou
      // esta. Manter o carimbo antigo diria que alguém conferiu o que ninguém viu.
      reviewedAt: null,
      reviewedById: null,
    };
    const saved = await getDatabase().$transaction(async (tx) => {
      const linha = await tx.scoutedTenderEditalReading.upsert({
        where: { tenderId: input.tenderId },
        create: { id: randomUUID(), tenderId: input.tenderId, ...dados },
        update: dados,
      });
      // O elo execução↔leitura é o que a tela consome e o que a auditoria
      // precisa para reencontrar a fonte. Sem este evento, ele só existiria
      // numa linha que pode ser sobrescrita por uma releitura.
      await tx.auditEvent.create({
        data: {
          id: randomUUID(),
          actorType: "USER",
          actorId,
          action: "EDITAL_READING_RECORDED",
          entityType: "SCOUTED_TENDER_EDITAL_READING",
          entityId: linha.id,
          correlationId,
          outcome: "SUCCESS",
          origin: "edital-reading",
          metadata: {
            tenderId: input.tenderId,
            executionId: input.executionId,
            sourceUri: input.source.uri,
            sourceFileHash: input.source.fileHash,
            servicesCount: input.requirement.services.length,
            limitationsCount: input.requirement.limitations.length,
            assistive: true,
          },
        },
      });
      return linha;
    });
    return editalReadingFromRow(saved);
  }

  /**
   * Carimba a conferência humana. Fora da porta do serviço de propósito: ler é
   * uma coisa, assumir a leitura é outra, e quem assume não é a máquina.
   *
   * Devolve `undefined` quando não há leitura para conferir, em vez de criar
   * uma — carimbar "conferido" no vazio seria a pior mentira possível aqui.
   */
  async markReviewed(tenderId: string, actorId: string, correlationId: string): Promise<StoredEditalReading | undefined> {
    const existing = await getDatabase().scoutedTenderEditalReading.findUnique({ where: { tenderId }, select: { id: true } });
    if (!existing) return undefined;
    const saved = await getDatabase().$transaction(async (tx) => {
      const linha = await tx.scoutedTenderEditalReading.update({
        where: { tenderId },
        data: { reviewedAt: new Date(), reviewedById: actorId },
      });
      await tx.auditEvent.create({
        data: {
          id: randomUUID(),
          actorType: "USER",
          actorId,
          action: "EDITAL_READING_REVIEWED",
          entityType: "SCOUTED_TENDER_EDITAL_READING",
          entityId: linha.id,
          correlationId,
          outcome: "SUCCESS",
          origin: "edital-reading",
          metadata: { tenderId, executionId: linha.executionId, sourceFileHash: linha.sourceFileHash },
        },
      });
      return linha;
    });
    return editalReadingFromRow(saved);
  }
}

export type EditalReadingRow = Readonly<{
  tenderId: string;
  executionId: string;
  sourceUri: string;
  sourceFilename: string;
  sourceFileHash: string;
  sourceFetchedAt: Date;
  services: unknown;
  consortiumAllowed: boolean | null;
  requiresCat: boolean | null;
  requiresSiteVisit: boolean | null;
  confidence: unknown;
  limitations: unknown;
  reviewedAt: Date | null;
}>;

/** Traz a linha de volta ao formato do domínio. */
export function editalReadingFromRow(row: EditalReadingRow): StoredEditalReading {
  return {
    tenderId: row.tenderId,
    executionId: row.executionId,
    source: {
      uri: row.sourceUri,
      filename: row.sourceFilename,
      fileHash: row.sourceFileHash,
      fetchedAt: row.sourceFetchedAt,
    },
    requirement: {
      services: Array.isArray(row.services) ? (row.services as RequiredService[]) : [],
      ...(row.consortiumAllowed !== null ? { consortiumAllowed: row.consortiumAllowed } : {}),
      ...(row.requiresCat !== null ? { requiresCat: row.requiresCat } : {}),
      ...(row.requiresSiteVisit !== null ? { requiresSiteVisit: row.requiresSiteVisit } : {}),
      // Decimal do Prisma não é number: comparar sem converter daria falso.
      ...(row.confidence !== null && row.confidence !== undefined ? { confidence: Number(row.confidence) } : {}),
      limitations: Array.isArray(row.limitations) ? (row.limitations as string[]) : [],
    },
    ...(row.reviewedAt ? { reviewedAt: row.reviewedAt } : {}),
  };
}
