import { randomUUID } from "node:crypto";
import { getDatabase } from "@/core/database/prisma";
import type { TechnicalEvidenceRepository } from "@/modules/technical-archive/application/technical-evidence-service";
import type { TechnicalEvidenceDraft } from "@/modules/technical-archive/domain/technical-evidence";

export class PrismaTechnicalEvidenceRepository implements TechnicalEvidenceRepository {
  async create(draft: TechnicalEvidenceDraft, actorId: string, correlationId: string) {
    return getDatabase().$transaction(async (transaction) => {
      const [experience, documentVersion] = await Promise.all([
        transaction.executedContract.findUniqueOrThrow({ where: { id: draft.experienceId }, select: { id: true } }),
        transaction.managedDocumentVersion.findUniqueOrThrow({ where: { id: draft.documentVersionId }, select: { documentId: true } }),
      ]);
      let version = 1;
      if (draft.previousVersionId) {
        const previous = await transaction.technicalEvidence.findUniqueOrThrow({ where: { id: draft.previousVersionId } });
        if (previous.experienceId !== experience.id || previous.type !== draft.type || previous.number !== draft.number) throw new Error("INVALID_TECHNICAL_EVIDENCE_VERSION_CHAIN");
        version = previous.version + 1;
      }
      if (draft.relatedCatId) {
        await transaction.technicalEvidence.findFirstOrThrow({ where: { id: draft.relatedCatId, type: "CAT", experienceId: experience.id } });
      }
      const evidence = await transaction.technicalEvidence.create({
        data: {
          id: randomUUID(),
          experienceId: experience.id,
          type: draft.type,
          number: draft.number,
          version,
          issuingBody: draft.issuingBody,
          issuedAt: draft.issuedAt,
          validUntil: draft.validUntil,
          status: draft.status,
          subjectActivity: draft.subjectActivity,
          professionalName: draft.professionalName,
          professionalIdentifier: draft.professionalIdentifier,
          startedAt: draft.startedAt,
          endedAt: draft.endedAt,
          restrictions: draft.restrictions,
          documentVersionId: draft.documentVersionId,
          previousVersionId: draft.previousVersionId,
          relatedCatId: draft.relatedCatId,
          createdById: actorId,
          correlationId,
        },
      });
      await transaction.managedDocumentLink.create({ data: { id: randomUUID(), documentId: documentVersion.documentId, entityType: "TECHNICAL_EVIDENCE", entityId: evidence.id, role: `${draft.type}_VERSION`, createdBy: actorId } });
      await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId, action: "TECHNICAL_EVIDENCE_VERSION_CREATED", entityType: "TECHNICAL_EVIDENCE", entityId: evidence.id, correlationId, outcome: "SUCCESS", origin: "technical-archive-service", metadata: { experienceId: experience.id, type: evidence.type, number: evidence.number, version: evidence.version, status: evidence.status, documentVersionId: evidence.documentVersionId } } });
      return { id: evidence.id, type: evidence.type, number: evidence.number, version: evidence.version, status: evidence.status };
    });
  }
}
