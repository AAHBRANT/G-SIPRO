import { randomUUID } from "node:crypto";

import { getDatabase } from "@/core/database/prisma";
import type { TenderRecord, TenderRepository } from "@/modules/tenders/application/tender-service";
import type { TenderDraft, TenderVersionDraft } from "@/modules/tenders/domain/tender";

export class TenderNotFoundError extends Error {
  constructor(id: string) { super(`Edital não encontrado: ${id}`); this.name = "TenderNotFoundError"; }
}

export class PrismaTenderRepository implements TenderRepository {
  async create(tender: TenderDraft, version: TenderVersionDraft, actorId: string, correlationId: string): Promise<TenderRecord> {
    return getDatabase().$transaction(async (transaction) => {
      const created = await transaction.tender.create({
        data: {
          id: randomUUID(), code: tender.code, number: tender.number, modality: tender.modality,
          subject: tender.subject, origin: tender.origin, opportunityId: tender.opportunityId,
          contractingAuthorityId: tender.contractingAuthorityId, createdBy: actorId, updatedBy: actorId,
          lots: { create: tender.lots.map((lot) => ({ id: randomUUID(), code: lot.code, subject: lot.subject, createdBy: actorId, updatedBy: actorId })) },
          versions: { create: this.versionData(version, 1, actorId) },
        },
      });
      await transaction.auditEvent.create({ data: {
        id: randomUUID(), actorType: "USER", actorId, action: "TENDER_CREATED", entityType: "TENDER",
        entityId: created.id, correlationId, outcome: "SUCCESS", origin: "tender-service",
        metadata: { code: created.code, documentVersion: 1, fileHash: version.fileHash },
      } });
      return { id: created.id, code: created.code, number: created.number, version: 1 };
    });
  }

  async addVersion(tenderId: string, version: TenderVersionDraft, actorId: string, correlationId: string): Promise<TenderRecord> {
    return getDatabase().$transaction(async (transaction) => {
      const tender = await transaction.tender.findUnique({ where: { id: tenderId }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } });
      if (!tender) throw new TenderNotFoundError(tenderId);
      const nextVersion = (tender.versions[0]?.version ?? 0) + 1;
      await transaction.tenderVersion.create({ data: { id: randomUUID(), tenderId, ...this.versionData(version, nextVersion, actorId) } });
      await transaction.auditEvent.create({ data: {
        id: randomUUID(), actorType: "USER", actorId, action: "TENDER_VERSION_ADDED", entityType: "TENDER",
        entityId: tenderId, correlationId, outcome: "SUCCESS", origin: "tender-service",
        metadata: { documentVersion: nextVersion, fileHash: version.fileHash },
      } });
      return { id: tender.id, code: tender.code, number: tender.number, version: nextVersion };
    });
  }

  private versionData(version: TenderVersionDraft, number: number, actorId: string) {
    return {
      version: number, fileName: version.fileName, fileHash: version.fileHash, uri: version.uri,
      mimeType: version.mimeType, sizeBytes: version.sizeBytes, source: version.source,
      receivedAt: version.receivedAt, createdBy: actorId,
      attachments: { create: version.attachments.map((attachment) => ({ id: randomUUID(), fileName: attachment.fileName, fileHash: attachment.fileHash, source: attachment.source, createdBy: actorId })) },
    };
  }
}
