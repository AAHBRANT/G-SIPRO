import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { getDatabase } from "@/core/database/prisma";
import type { MatrixExportRepository } from "@/modules/compliance-matrices/application/matrix-export-service";
import { canonicalStringify } from "@/modules/compliance-matrices/domain/canonical-json";

export class MatrixExportNotFoundError extends Error { constructor(message = "Matriz ou exportação não encontrada.") { super(message); this.name = "MatrixExportNotFoundError"; } }
export class MatrixFinalizationRuleError extends Error { constructor(message: string) { super(message); this.name = "MatrixFinalizationRuleError"; } }
export class MatrixExportIntegrityError extends Error { constructor() { super("A integridade da exportação não pôde ser confirmada."); this.name = "MatrixExportIntegrityError"; } }

const finalizeInclude = {
  tenderVersion: { include: { tender: true } },
  history: { orderBy: { version: "desc" as const } },
  exports: { orderBy: { exportedAt: "desc" as const } },
  items: { include: {
    evidenceLinks: { include: { technicalEvidence: true, evidenceDocumentVersion: { include: { document: true } }, comparisons: { include: { executedQuantity: true }, orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] } }, orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] },
    assessments: { include: { responsible: true, validatedBy: true }, orderBy: { version: "asc" as const } },
  }, orderBy: [{ sourcePage: "asc" as const }, { id: "asc" as const }] },
};
type FinalizableMatrix = Prisma.ComplianceMatrixGetPayload<{ include: typeof finalizeInclude }>;

function exportRecord(record: { id: string; matrixId: string; matrixVersion: number; fileName: string; fileHash: string; exportedAt: Date }) { return { id: record.id, matrixId: record.matrixId, matrixVersion: record.matrixVersion, fileName: record.fileName, fileHash: record.fileHash, exportedAt: record.exportedAt }; }

export class PrismaMatrixExportRepository implements MatrixExportRepository {
  async finalize(matrixId: string, actorId: string, correlationId: string) {
    return getDatabase().$transaction(async transaction => {
      const matrix = await transaction.complianceMatrix.findUnique({ where: { id: matrixId }, include: finalizeInclude });
      if (!matrix) throw new MatrixExportNotFoundError("Matriz não encontrada.");
      if (matrix.status === "VALIDATED" && matrix.exports[0]) return exportRecord(matrix.exports[0]);
      if (matrix.status !== "IN_ANALYSIS") throw new MatrixFinalizationRuleError("A matriz não pode ser consolidada nesse estado.");
      for (const item of matrix.items) {
        const latest = item.assessments.at(-1);
        if (!latest) throw new MatrixFinalizationRuleError("Todos os itens precisam de validação técnica humana.");
        const snapshot = latest.evidenceSnapshot as Array<{ associationId?: string }>;
        const currentIds = item.evidenceLinks.map(link => link.id);
        if (latest.evidenceCount !== currentIds.length || !Array.isArray(snapshot) || snapshot.map(entry => entry.associationId).join("|") !== currentIds.join("|")) throw new MatrixFinalizationRuleError("Existe item com evidência nova aguardando revalidação.");
      }
      const exportedAt = new Date();
      const payload = this.buildPayload(matrix, exportedAt);
      const content = canonicalStringify(payload);
      const fileHash = createHash("sha256").update(content, "utf8").digest("hex");
      const fileName = `GSIPRO_MATRIZ_${matrix.id}_V${matrix.version}.json`;
      await transaction.complianceMatrix.update({ where: { id: matrix.id }, data: { status: "VALIDATED", updatedBy: actorId } });
      const historyVersion = (matrix.history[0]?.version ?? 0) + 1;
      await transaction.complianceMatrixHistory.create({ data: { id: randomUUID(), matrixId: matrix.id, version: historyVersion, action: "VALIDATED_AND_EXPORTED", snapshot: { status: "VALIDATED", matrixVersion: matrix.version, sourceFileHash: matrix.sourceFileHash, itemCount: matrix.itemCount, fileHash }, changedById: actorId, correlationId } });
      const created = await transaction.complianceMatrixExport.create({ data: { id: randomUUID(), matrixId: matrix.id, matrixVersion: matrix.version, format: "JSON", fileName, fileHash, payload: payload as Prisma.InputJsonValue, exportedAt, exportedById: actorId, correlationId } });
      await transaction.auditEvent.createMany({ data: [
        { id: randomUUID(), actorType: "USER", actorId, action: "COMPLIANCE_MATRIX_VALIDATED", entityType: "COMPLIANCE_MATRIX", entityId: matrix.id, correlationId, outcome: "SUCCESS", origin: "compliance-matrix-service", metadata: { matrixVersion: matrix.version, items: matrix.itemCount, sourceFileHash: matrix.sourceFileHash } },
        { id: randomUUID(), actorType: "USER", actorId, action: "COMPLIANCE_MATRIX_EXPORTED", entityType: "COMPLIANCE_MATRIX_EXPORT", entityId: created.id, correlationId, outcome: "SUCCESS", origin: "compliance-matrix-service", metadata: { matrixId: matrix.id, matrixVersion: matrix.version, format: "JSON", fileName, fileHash } },
      ] });
      return exportRecord(created);
    });
  }

  async download(exportId: string, actorId: string, correlationId: string) {
    const database = getDatabase();
    const record = await database.complianceMatrixExport.findUnique({ where: { id: exportId } });
    if (!record) throw new MatrixExportNotFoundError("Exportação não encontrada.");
    const content = canonicalStringify(record.payload);
    if (createHash("sha256").update(content, "utf8").digest("hex") !== record.fileHash) throw new MatrixExportIntegrityError();
    await database.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId, action: "COMPLIANCE_MATRIX_EXPORT_DOWNLOADED", entityType: "COMPLIANCE_MATRIX_EXPORT", entityId: record.id, correlationId, outcome: "SUCCESS", origin: "compliance-matrix-service", metadata: { matrixId: record.matrixId, matrixVersion: record.matrixVersion, fileHash: record.fileHash } } });
    return { ...exportRecord(record), content };
  }

  private buildPayload(matrix: FinalizableMatrix, exportedAt: Date) {
    return {
      schemaVersion: "GSIPRO-COMPLIANCE-MATRIX-1.0",
      exportedAt: exportedAt.toISOString(),
      matrix: { id: matrix.id, version: matrix.version, status: "VALIDATED", analysisReference: matrix.analysisReference, itemCount: matrix.itemCount },
      source: { tenderVersionId: matrix.tenderVersionId, tenderVersion: matrix.tenderVersion.version, fileName: matrix.tenderVersion.fileName, fileHash: matrix.sourceFileHash, source: matrix.tenderVersion.source, receivedAt: matrix.tenderVersion.receivedAt.toISOString() },
      tender: { id: matrix.tenderVersion.tender.id, code: matrix.tenderVersion.tender.code, number: matrix.tenderVersion.tender.number, subject: matrix.tenderVersion.tender.subject },
      items: matrix.items.map(item => ({ id: item.id, requirement: { id: item.requirementId, version: item.requirementVersion, type: item.requirementType, text: item.requirementText, criticality: item.criticality, sourceExcerpt: item.sourceExcerpt, sourcePage: item.sourcePage }, evidence: item.evidenceLinks.map(link => ({ associationId: link.id, technicalEvidence: { id: link.technicalEvidenceId, type: link.technicalEvidence.type, number: link.technicalEvidence.number, version: link.technicalEvidence.version, status: link.technicalEvidence.status }, document: { id: link.evidenceDocumentVersion.document.id, title: link.evidenceDocumentVersion.document.title, type: link.evidenceDocumentVersion.document.type, classification: link.evidenceDocumentVersion.document.classification, versionId: link.evidenceDocumentVersionId, version: link.evidenceDocumentVersion.version, fileHash: link.evidenceFileHash }, locator: link.locator, justification: link.justification, comparisons: link.comparisons.map(comparison => ({ id: comparison.id, requiredValue: comparison.requiredValue.toString(), requiredUnit: comparison.requiredUnit, provenValue: comparison.provenValue.toString(), provenUnit: comparison.provenUnit, normalizedProvenValue: comparison.normalizedProvenValue.toString(), difference: comparison.difference.toString(), conversionFactor: comparison.conversionFactor?.toString() ?? null, conversionRule: comparison.conversionRule, conversionSource: comparison.conversionSource, quantitySource: comparison.executedQuantity.source })) })), validations: item.assessments.map(assessment => ({ id: assessment.id, version: assessment.version, previousAssessmentId: assessment.previousAssessmentId, decision: assessment.decision, justification: assessment.justification, gapDescription: assessment.gapDescription, riskDescription: assessment.riskDescription, impact: assessment.impact, treatment: assessment.treatment, responsible: assessment.responsible ? { id: assessment.responsible.id, displayName: assessment.responsible.displayName } : null, dueAt: assessment.dueAt?.toISOString() ?? null, evidenceCount: assessment.evidenceCount, evidenceSnapshot: assessment.evidenceSnapshot, validatedAt: assessment.validatedAt.toISOString(), validatedBy: { id: assessment.validatedBy.id, displayName: assessment.validatedBy.displayName } })) })),
    };
  }
}
