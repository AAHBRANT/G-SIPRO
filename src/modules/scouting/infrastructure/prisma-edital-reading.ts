/**
 * Adaptadores da leitura de edital: PNCP, acervo documental, extração e banco.
 *
 * Aqui mora o que encosta em infraestrutura. As regras — o que impede a
 * leitura, quando não vale reler, o que não pode virar leitura gravada — ficam
 * em `edital-reading-service.ts`, testadas sem banco nem rede.
 */
import { randomUUID } from "node:crypto";

import type { AuthorizationContext } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import { storeDocumentFile } from "@/core/storage/document-storage";
import { AiExtractionService } from "@/modules/ai-extraction/application/ai-extraction-service";
import { OpenAiResponsesProvider } from "@/modules/ai-extraction/infrastructure/openai-responses-provider";
import { PrismaAiExtractionRepository } from "@/modules/ai-extraction/infrastructure/prisma-ai-extraction-repository";
import type {
  EditalArchivePort,
  EditalExtractionPort,
  EditalReadingRepository,
  StoredEditalReading,
} from "@/modules/scouting/application/edital-reading-service";
import type { EditalRequirement, RequiredService } from "@/modules/scouting/domain/edital-requirement";

/** Vínculo do arquivo com a licitação, para o acervo dizer de onde ele veio. */
const LINK_ENTITY = "SCOUTED_TENDER";

export class PrismaEditalArchive implements EditalArchivePort {
  async findVersionByHash(fileHash: string) {
    const found = await getDatabase().managedDocumentVersion.findFirst({
      where: { fileHash, document: { type: "EDITAL" } },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    return found ?? undefined;
  }

  async archive(
    input: Readonly<{ tenderId: string; title: string; filename: string; mimeType: string; bytes: Buffer; origin: string }>,
    actorId: string,
    correlationId: string,
  ) {
    // O armazenamento é endereçado pelo conteúdo: gravar duas vezes o mesmo
    // arquivo não duplica bytes em disco.
    const stored = await storeDocumentFile(
      new File([new Uint8Array(input.bytes)], input.filename, { type: input.mimeType }),
    );

    const versionId = await getDatabase().$transaction(async (tx) => {
      const document = await tx.managedDocument.create({
        data: {
          id: randomUUID(),
          type: "EDITAL",
          title: input.title,
          // Edital é público por definição: é o ato que convoca a disputa.
          classification: "PUBLIC",
          status: "ACTIVE",
          ownerId: actorId,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      const version = await tx.managedDocumentVersion.create({
        data: {
          id: randomUUID(),
          documentId: document.id,
          version: 1,
          uri: stored.uri,
          fileHash: stored.fileHash,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          origin: input.origin,
          createdBy: actorId,
        },
      });
      await tx.managedDocumentLink.create({
        data: {
          id: randomUUID(),
          documentId: document.id,
          entityType: LINK_ENTITY,
          entityId: input.tenderId,
          role: "EDITAL",
          createdBy: actorId,
        },
      });
      await tx.auditEvent.create({
        data: {
          id: randomUUID(),
          actorType: "USER",
          actorId,
          action: "DOCUMENT_VERSION_CREATED",
          entityType: "MANAGED_DOCUMENT",
          entityId: document.id,
          correlationId,
          outcome: "SUCCESS",
          origin: "edital-reading",
          metadata: { tenderId: input.tenderId, fileHash: stored.fileHash, sizeBytes: stored.sizeBytes.toString(), source: input.origin },
        },
      });
      return version.id;
    });

    return { versionId };
  }
}

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

  async run(
    input: Readonly<{ idempotencyKey: string; definitionId: string; documentVersionId: string; requestedFields: readonly string[] }>,
    auth: AuthorizationContext,
    correlationId: string,
  ) {
    return this.service.execute({ ...input, requestedFields: [...input.requestedFields] }, auth, correlationId);
  }
}

export class PrismaEditalReadingRepository implements EditalReadingRepository {
  async tender(tenderId: string) {
    const found = await getDatabase().scoutedTender.findUnique({
      where: { id: tenderId },
      select: { id: true, externalId: true, subject: true },
    });
    // O objeto da licitação faz as vezes de título do documento arquivado — o
    // serviço corta no limite da coluna.
    return found ? { id: found.id, externalId: found.externalId, title: found.subject } : undefined;
  }

  async find(tenderId: string) {
    const found = await getDatabase().scoutedTenderEditalReading.findUnique({ where: { tenderId } });
    return found ? editalReadingFromRow(found) : undefined;
  }

  async save(
    input: Readonly<{ tenderId: string; documentVersionId: string; requirement: EditalRequirement }>,
    actorId: string,
  ) {
    const dados = {
      documentVersionId: input.documentVersionId,
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
    const saved = await getDatabase().scoutedTenderEditalReading.upsert({
      where: { tenderId: input.tenderId },
      create: { id: randomUUID(), tenderId: input.tenderId, ...dados },
      update: dados,
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
  async markReviewed(tenderId: string, actorId: string): Promise<StoredEditalReading | undefined> {
    const existing = await getDatabase().scoutedTenderEditalReading.findUnique({ where: { tenderId }, select: { id: true } });
    if (!existing) return undefined;
    const saved = await getDatabase().scoutedTenderEditalReading.update({
      where: { tenderId },
      data: { reviewedAt: new Date(), reviewedById: actorId },
    });
    return editalReadingFromRow(saved);
  }
}

export type EditalReadingRow = Readonly<{
  tenderId: string;
  documentVersionId: string;
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
    documentVersionId: row.documentVersionId,
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
