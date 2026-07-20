import { randomUUID } from "node:crypto";
import { getDatabase } from "@/core/database/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { ComplianceMatrixRecord, ComplianceMatrixRepository } from "@/modules/compliance-matrices/application/matrix-service";
import type { ComplianceMatrixDraft } from "@/modules/compliance-matrices/domain/matrix";

export class MatrixSourceNotFoundError extends Error { constructor() { super("Versão do edital não encontrada."); this.name = "MatrixSourceNotFoundError"; } }
export class MatrixRequirementsBlockedError extends Error { constructor(message: string) { super(message); this.name = "MatrixRequirementsBlockedError"; } }

const matrixInclude = {
  tenderVersion: { include: { tender: true } },
  exports: { orderBy: { exportedAt: "desc" as const } },
  items: { include: { evidenceLinks: { include: { technicalEvidence: true, evidenceDocumentVersion: { include: { document: true } }, comparisons: { include: { executedQuantity: true }, orderBy: { createdAt: "asc" as const } } }, orderBy: { createdAt: "asc" as const } }, assessments: { include: { responsible: true, validatedBy: true }, orderBy: { version: "desc" as const } } }, orderBy: [{ criticality: "desc" as const }, { sourcePage: "asc" as const }] },
};
type MatrixWithRelations = Prisma.ComplianceMatrixGetPayload<{ include: typeof matrixInclude }>;

export class PrismaComplianceMatrixRepository implements ComplianceMatrixRepository {
  async create(draft: ComplianceMatrixDraft, actorId: string, correlationId: string) {
    return getDatabase().$transaction(async transaction => {
      const source = await transaction.tenderVersion.findUnique({ where: { id: draft.tenderVersionId }, include: { tender: true, requirements: { orderBy: [{ criticality: "desc" }, { createdAt: "asc" }] } } });
      if (!source) throw new MatrixSourceNotFoundError();
      const blocking = source.requirements.filter(requirement => requirement.status === "DRAFT" || requirement.status === "PENDING_VALIDATION");
      if (blocking.length > 0) throw new MatrixRequirementsBlockedError(`Existem ${blocking.length} requisito(s) ainda não validado(s) na versão do edital.`);
      const requirements = source.requirements.filter(requirement => requirement.status === "VALIDATED");
      if (requirements.length === 0) throw new MatrixRequirementsBlockedError("A versão do edital não possui requisitos validados para compor a matriz.");
      const matrix = await transaction.complianceMatrix.create({ data: { id: randomUUID(), tenderVersionId: source.id, analysisReference: draft.analysisReference, version: 1, status: "IN_ANALYSIS", sourceFileHash: source.fileHash, itemCount: requirements.length, createdBy: actorId, updatedBy: actorId } });
      await transaction.complianceMatrixItem.createMany({ data: requirements.map(requirement => ({ id: randomUUID(), matrixId: matrix.id, requirementId: requirement.id, requirementVersion: requirement.version, requirementType: requirement.type, requirementText: requirement.text, criticality: requirement.criticality, sourceExcerpt: requirement.sourceExcerpt, sourcePage: requirement.sourcePage, createdBy: actorId })) });
      await transaction.complianceMatrixHistory.create({ data: { id: randomUUID(), matrixId: matrix.id, version: 1, action: "CREATED", snapshot: { tenderVersionId: source.id, tenderVersion: source.version, sourceFileHash: source.fileHash, analysisReference: draft.analysisReference, status: "IN_ANALYSIS", items: requirements.map(requirement => ({ requirementId: requirement.id, requirementVersion: requirement.version, sourcePage: requirement.sourcePage })) }, changedById: actorId, correlationId } });
      await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId, action: "COMPLIANCE_MATRIX_CREATED", entityType: "COMPLIANCE_MATRIX", entityId: matrix.id, correlationId, outcome: "SUCCESS", origin: "compliance-matrix-service", metadata: { tenderVersionId: source.id, tenderVersion: source.version, sourceFileHash: source.fileHash, items: requirements.length, status: "IN_ANALYSIS" } } });
      return this.findRecord(transaction, matrix.id);
    });
  }

  async list(actorId: string, correlationId: string) {
    const database = getDatabase();
    const records = await database.complianceMatrix.findMany({ include: matrixInclude, orderBy: { createdAt: "desc" } });
    await database.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId, action: "COMPLIANCE_MATRICES_ACCESSED", entityType: "COMPLIANCE_MATRIX_COLLECTION", entityId: "matrices", correlationId, outcome: "SUCCESS", origin: "compliance-matrix-service", metadata: { records: records.length } } });
    return records.map(record => this.toRecord(record));
  }

  private async findRecord(transaction: Prisma.TransactionClient, id: string): Promise<ComplianceMatrixRecord> {
    const record = await transaction.complianceMatrix.findUniqueOrThrow({ where: { id }, include: matrixInclude });
    return this.toRecord(record);
  }

  private toRecord(record: MatrixWithRelations): ComplianceMatrixRecord {
    return { id: record.id, analysisReference: record.analysisReference, version: record.version, status: record.status, sourceFileHash: record.sourceFileHash, itemCount: record.itemCount, tender: { id: record.tenderVersion.tender.id, code: record.tenderVersion.tender.code, number: record.tenderVersion.tender.number, subject: record.tenderVersion.tender.subject, version: record.tenderVersion.version, fileName: record.tenderVersion.fileName }, exports: record.exports.map(item => ({ id: item.id, fileName: item.fileName, fileHash: item.fileHash, exportedAt: item.exportedAt })), items: record.items.map(item => ({ id: item.id, requirementId: item.requirementId, requirementVersion: item.requirementVersion, requirementType: item.requirementType, requirementText: item.requirementText, criticality: item.criticality, sourceExcerpt: item.sourceExcerpt, sourcePage: item.sourcePage, evidenceLinks: item.evidenceLinks.map(link => ({ id: link.id, technicalEvidenceId: link.technicalEvidenceId, evidenceLabel: `${link.technicalEvidence.type} ${link.technicalEvidence.number} v${link.technicalEvidence.version}`, evidenceStatus: link.technicalEvidence.status, documentLabel: `${link.evidenceDocumentVersion.document.title} v${link.evidenceDocumentVersion.version}`, evidenceFileHash: link.evidenceFileHash, locator: link.locator, justification: link.justification, comparisons: link.comparisons.map(comparison => ({ id: comparison.id, requiredValue: comparison.requiredValue.toString(), requiredUnit: comparison.requiredUnit, provenValue: comparison.provenValue.toString(), provenUnit: comparison.provenUnit, normalizedProvenValue: comparison.normalizedProvenValue.toString(), difference: comparison.difference.toString(), conversionFactor: comparison.conversionFactor?.toString() ?? null, conversionRule: comparison.conversionRule, conversionSource: comparison.conversionSource, quantitySource: comparison.executedQuantity.source })) })), assessments: item.assessments.map(assessment => ({ id: assessment.id, version: assessment.version, decision: assessment.decision, justification: assessment.justification, gapDescription: assessment.gapDescription, riskDescription: assessment.riskDescription, impact: assessment.impact, treatment: assessment.treatment, responsible: assessment.responsible?.displayName ?? null, responsibleId: assessment.responsibleId, dueAt: assessment.dueAt, evidenceCount: assessment.evidenceCount, validatedAt: assessment.validatedAt, validatedBy: assessment.validatedBy.displayName })) })) };
  }
}
