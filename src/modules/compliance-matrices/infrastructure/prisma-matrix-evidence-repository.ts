import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { getDatabase } from "@/core/database/prisma";
import type { MatrixEvidenceRepository } from "@/modules/compliance-matrices/application/matrix-evidence-service";
import type { MatrixEvidenceDraft } from "@/modules/compliance-matrices/domain/matrix-evidence";

export class MatrixItemNotFoundError extends Error { constructor() { super("Item da matriz não encontrado."); this.name = "MatrixItemNotFoundError"; } }
export class MatrixEvidenceNotFoundError extends Error { constructor() { super("Evidência técnica não encontrada."); this.name = "MatrixEvidenceNotFoundError"; } }
export class MatrixQuantityNotFoundError extends Error { constructor() { super("Quantitativo executado não encontrado."); this.name = "MatrixQuantityNotFoundError"; } }
export class MatrixEvidenceRuleError extends Error { constructor(message: string) { super(message); this.name = "MatrixEvidenceRuleError"; } }

export class PrismaMatrixEvidenceRepository implements MatrixEvidenceRepository {
  async associate(matrixItemId: string, draft: MatrixEvidenceDraft, actorId: string, correlationId: string) {
    return getDatabase().$transaction(async transaction => {
      const item = await transaction.complianceMatrixItem.findUnique({ where: { id: matrixItemId }, include: { matrix: true } });
      if (!item) throw new MatrixItemNotFoundError();
      if (item.matrix.status !== "IN_ANALYSIS") throw new MatrixEvidenceRuleError("A matriz não está mais em análise.");
      const evidence = await transaction.technicalEvidence.findUnique({ where: { id: draft.technicalEvidenceId }, include: { documentVersion: true } });
      if (!evidence) throw new MatrixEvidenceNotFoundError();
      const quantities = draft.comparisons.length > 0 ? await transaction.executedQuantity.findMany({ where: { id: { in: draft.comparisons.map(comparison => comparison.executedQuantityId) } }, include: { service: true } }) : [];
      if (quantities.length !== new Set(draft.comparisons.map(comparison => comparison.executedQuantityId)).size) throw new MatrixQuantityNotFoundError();
      const associationId = randomUUID();
      const comparisonRecords = draft.comparisons.map(comparison => {
        const quantity = quantities.find(candidate => candidate.id === comparison.executedQuantityId)!;
        if (quantity.service.contractId !== evidence.experienceId) throw new MatrixEvidenceRuleError("O quantitativo deve pertencer à experiência comprovada pela evidência selecionada.");
        const sameUnit = quantity.unit.trim().toLocaleLowerCase("pt-BR") === comparison.requiredUnit.trim().toLocaleLowerCase("pt-BR");
        const hasConversion = comparison.conversionFactor !== undefined && comparison.conversionRule !== undefined && comparison.conversionSource !== undefined;
        if (sameUnit && hasConversion) throw new MatrixEvidenceRuleError("Não informe conversão quando as unidades são iguais.");
        if (!sameUnit && !hasConversion) throw new MatrixEvidenceRuleError("Unidades diferentes exigem fator, regra e fonte de conversão.");
        const provenValue = new Prisma.Decimal(quantity.value);
        const normalizedProvenValue = provenValue.mul(hasConversion ? new Prisma.Decimal(comparison.conversionFactor!) : 1).toDecimalPlaces(6);
        const requiredValue = new Prisma.Decimal(comparison.requiredValue).toDecimalPlaces(6);
        return { id: randomUUID(), evidenceAssociationId: associationId, executedQuantityId: quantity.id, requiredValue, requiredUnit: comparison.requiredUnit, provenValue, provenUnit: quantity.unit, normalizedProvenValue, difference: normalizedProvenValue.sub(requiredValue), conversionFactor: hasConversion ? new Prisma.Decimal(comparison.conversionFactor!) : null, conversionRule: comparison.conversionRule, conversionSource: comparison.conversionSource, createdBy: actorId, correlationId };
      });
      const association = await transaction.complianceMatrixEvidence.create({ data: { id: associationId, matrixItemId, technicalEvidenceId: evidence.id, evidenceDocumentVersionId: evidence.documentVersionId, evidenceFileHash: evidence.documentVersion.fileHash, locator: draft.locator, justification: draft.justification, createdBy: actorId, correlationId } });
      if (comparisonRecords.length > 0) await transaction.complianceQuantityComparison.createMany({ data: comparisonRecords });
      await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId, action: "MATRIX_EVIDENCE_ASSOCIATED", entityType: "COMPLIANCE_MATRIX_ITEM", entityId: matrixItemId, correlationId, outcome: "SUCCESS", origin: "compliance-matrix-service", metadata: { matrixId: item.matrixId, technicalEvidenceId: evidence.id, evidenceType: evidence.type, evidenceVersion: evidence.version, evidenceFileHash: evidence.documentVersion.fileHash, comparisons: comparisonRecords.length, conversions: comparisonRecords.filter(comparison => comparison.conversionFactor !== null).length } } });
      return { id: association.id, matrixItemId, technicalEvidenceId: evidence.id, evidenceFileHash: evidence.documentVersion.fileHash, locator: association.locator, comparisons: comparisonRecords.length };
    });
  }
}

