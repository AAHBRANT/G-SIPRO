import { randomUUID } from "node:crypto";
import { getDatabase } from "@/core/database/prisma";
import type { ItemAssessmentRepository } from "@/modules/compliance-matrices/application/item-assessment-service";
import type { ItemAssessmentDraft } from "@/modules/compliance-matrices/domain/item-assessment";

export class AssessmentItemNotFoundError extends Error { constructor() { super("Item da matriz não encontrado."); this.name = "AssessmentItemNotFoundError"; } }
export class AssessmentResponsibleNotFoundError extends Error { constructor() { super("Responsável ativo não encontrado."); this.name = "AssessmentResponsibleNotFoundError"; } }
export class AssessmentRuleError extends Error { constructor(message: string) { super(message); this.name = "AssessmentRuleError"; } }

export class PrismaItemAssessmentRepository implements ItemAssessmentRepository {
  async validate(matrixItemId: string, draft: ItemAssessmentDraft, actorId: string, correlationId: string) {
    return getDatabase().$transaction(async transaction => {
      const item = await transaction.complianceMatrixItem.findUnique({ where: { id: matrixItemId }, include: { matrix: true, evidenceLinks: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] }, assessments: { orderBy: { version: "desc" }, take: 1 } } });
      if (!item) throw new AssessmentItemNotFoundError();
      if (item.matrix.status !== "IN_ANALYSIS") throw new AssessmentRuleError("A matriz não está mais em análise.");
      if ((draft.decision === "MEETS" || draft.decision === "PARTIAL") && item.evidenceLinks.length === 0) throw new AssessmentRuleError("Conclusão positiva exige ao menos uma evidência associada.");
      if (draft.responsibleId) {
        const responsible = await transaction.user.findFirst({ where: { id: draft.responsibleId, status: "ACTIVE" } });
        if (!responsible) throw new AssessmentResponsibleNotFoundError();
        if (!draft.dueAt || new Date(draft.dueAt).getTime() <= Date.now()) throw new AssessmentRuleError("O prazo do tratamento deve ser futuro e informado pelo responsável.");
      }
      const previous = item.assessments[0];
      const version = (previous?.version ?? 0) + 1;
      const evidenceSnapshot = item.evidenceLinks.map(link => ({ associationId: link.id, technicalEvidenceId: link.technicalEvidenceId, fileHash: link.evidenceFileHash }));
      const assessment = await transaction.complianceItemAssessment.create({ data: { id: randomUUID(), matrixItemId, version, previousAssessmentId: previous?.id, decision: draft.decision, justification: draft.justification, gapDescription: draft.gapDescription, riskDescription: draft.riskDescription, impact: draft.impact, treatment: draft.treatment, responsibleId: draft.responsibleId, dueAt: draft.dueAt ? new Date(draft.dueAt) : undefined, evidenceCount: evidenceSnapshot.length, evidenceSnapshot, validatedById: actorId, correlationId } });
      await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId, action: "COMPLIANCE_ITEM_VALIDATED", entityType: "COMPLIANCE_MATRIX_ITEM", entityId: matrixItemId, correlationId, outcome: "SUCCESS", origin: "compliance-matrix-service", metadata: { matrixId: item.matrixId, assessmentId: assessment.id, version, decision: assessment.decision, evidenceCount: evidenceSnapshot.length, hasGapTreatment: Boolean(draft.gapDescription), responsibleId: draft.responsibleId ?? null, dueAt: draft.dueAt ?? null } } });
      return { id: assessment.id, matrixItemId, version, decision: assessment.decision, evidenceCount: assessment.evidenceCount, validatedAt: assessment.validatedAt };
    });
  }
}

