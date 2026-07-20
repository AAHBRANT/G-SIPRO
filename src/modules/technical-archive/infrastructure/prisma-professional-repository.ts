import { randomUUID } from "node:crypto";
import { getDatabase } from "@/core/database/prisma";
import type { ProfessionalRepository } from "@/modules/technical-archive/application/professional-service";
import type { ProfessionalDraft } from "@/modules/technical-archive/domain/professional";

export class PrismaProfessionalRepository implements ProfessionalRepository {
  async create(draft: ProfessionalDraft, actorId: string, correlationId: string) {
    return getDatabase().$transaction(async transaction => {
      const professional = await transaction.professional.create({ data: { id: randomUUID(), fullName: draft.fullName, council: draft.council, registrationNumber: draft.registrationNumber, nationalRegistration: draft.nationalRegistration, professionalTitle: draft.professionalTitle, status: draft.status, processingPurpose: draft.processingPurpose, legalBasis: draft.legalBasis, classification: "PERSONAL_DATA", version: 1, createdById: actorId } });
      for (const draftLink of draft.links) {
        const documentVersion = await transaction.managedDocumentVersion.findUniqueOrThrow({ where: { id: draftLink.evidenceDocumentVersionId }, select: { documentId: true } });
        let targetData: { contractId?: string; workId?: string; technicalEvidenceId?: string };
        if (draftLink.targetType === "CONTRACT") {
          const target = await transaction.executedContract.findUniqueOrThrow({ where: { id: draftLink.targetId }, select: { id: true } });
          targetData = { contractId: target.id };
        } else if (draftLink.targetType === "WORK") {
          const target = await transaction.executedWork.findUniqueOrThrow({ where: { id: draftLink.targetId }, select: { id: true } });
          targetData = { workId: target.id };
        } else {
          const target = await transaction.technicalEvidence.findUniqueOrThrow({ where: { id: draftLink.targetId }, select: { id: true, type: true, documentVersionId: true } });
          if (target.type === "ATTESTATION") throw new Error("INVALID_PROFESSIONAL_EVIDENCE_TARGET");
          if (target.documentVersionId !== draftLink.evidenceDocumentVersionId) throw new Error("PROFESSIONAL_LINK_DOCUMENT_MISMATCH");
          targetData = { technicalEvidenceId: target.id };
        }
        const link = await transaction.professionalLink.create({ data: { id: randomUUID(), professionalId: professional.id, targetType: draftLink.targetType, ...targetData, role: draftLink.role, responsibility: draftLink.responsibility, startedAt: draftLink.startedAt, endedAt: draftLink.endedAt, source: draftLink.source, evidenceDocumentVersionId: draftLink.evidenceDocumentVersionId, createdById: actorId, correlationId } });
        await transaction.managedDocumentLink.create({ data: { id: randomUUID(), documentId: documentVersion.documentId, entityType: "PROFESSIONAL_LINK", entityId: link.id, role: "SUPPORTING_EVIDENCE", createdBy: actorId } });
      }
      await transaction.professionalHistory.create({ data: { id: randomUUID(), professionalId: professional.id, version: 1, action: "CREATED", snapshot: { fullName: draft.fullName, council: draft.council, registrationNumber: draft.registrationNumber, nationalRegistration: draft.nationalRegistration, professionalTitle: draft.professionalTitle, status: draft.status, processingPurpose: draft.processingPurpose, legalBasis: draft.legalBasis, classification: "PERSONAL_DATA", links: draft.links.map(link => ({ targetType: link.targetType, targetId: link.targetId, role: link.role, startedAt: link.startedAt.toISOString(), endedAt: link.endedAt.toISOString(), source: link.source, evidenceDocumentVersionId: link.evidenceDocumentVersionId })) }, changedById: actorId, correlationId } });
      await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId, action: "PROFESSIONAL_CREATED", entityType: "PROFESSIONAL", entityId: professional.id, correlationId, outcome: "SUCCESS", origin: "technical-professional-service", metadata: { classification: "PERSONAL_DATA", status: professional.status, links: draft.links.length } } });
      return { id: professional.id, fullName: professional.fullName, council: professional.council, registrationNumber: professional.registrationNumber, status: professional.status, version: professional.version, links: draft.links.length };
    });
  }

  async list(actorId: string, correlationId: string) {
    return getDatabase().$transaction(async transaction => {
      const records = await transaction.professional.findMany({ include: { links: { include: { contract: true, work: true, technicalEvidence: true, evidenceDocumentVersion: { include: { document: true } } }, orderBy: { createdAt: "asc" } } }, orderBy: { fullName: "asc" } });
      await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId, action: "PROFESSIONAL_DATA_ACCESSED", entityType: "PROFESSIONAL_COLLECTION", entityId: "technical-archive", correlationId, outcome: "SUCCESS", origin: "technical-professional-service", metadata: { classification: "PERSONAL_DATA", records: records.length, purpose: "AUTHORIZED_TECHNICAL_ARCHIVE_USE" } } });
      return records.map(record => ({ id: record.id, fullName: record.fullName, council: record.council, registrationNumber: record.registrationNumber, nationalRegistration: record.nationalRegistration, professionalTitle: record.professionalTitle, status: record.status, classification: record.classification, processingPurpose: record.processingPurpose, legalBasis: record.legalBasis, links: record.links.map(link => ({ id: link.id, targetType: link.targetType, targetLabel: link.contract?.code ?? link.work?.name ?? (link.technicalEvidence ? `${link.technicalEvidence.type} ${link.technicalEvidence.number} v${link.technicalEvidence.version}` : "Não identificado"), role: link.role, responsibility: link.responsibility, startedAt: link.startedAt, endedAt: link.endedAt, source: link.source, documentLabel: `${link.evidenceDocumentVersion.document.title} v${link.evidenceDocumentVersion.version}` })) }));
    });
  }
}
