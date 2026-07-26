import { randomUUID } from "node:crypto";
import { getDatabase } from "@/core/database/prisma";
import type { IntelligencePolicyRepository } from "../application/intelligence-policy-service";
import type { IntelligencePolicyApprovalDraft, IntelligencePolicyDraft } from "../domain/intelligence-policy";

export class IntelligencePolicyNotFoundError extends Error {}
export class IntelligencePolicyRuleError extends Error {}

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

export class PrismaIntelligencePolicyRepository implements IntelligencePolicyRepository {
  async addPolicy(draft: IntelligencePolicyDraft, actorId: string, correlationId: string) {
    return getDatabase().$transaction(async transaction => {
      let previous = null;
      if (draft.previousPolicyId) {
        previous = await transaction.intelligencePolicy.findUnique({ where: { id: draft.previousPolicyId } });
        if (!previous) throw new IntelligencePolicyNotFoundError("Política anterior não encontrada.");
        if (previous.code !== draft.code) throw new IntelligencePolicyRuleError("O código da política não pode mudar entre versões.");
        const latest = await transaction.intelligencePolicy.findFirst({
          where: { policyKey: previous.policyKey },
          orderBy: { version: "desc" },
        });
        if (latest?.id !== previous.id) throw new IntelligencePolicyRuleError("A revisão deve partir da política mais recente.");
      }

      const policy = await transaction.intelligencePolicy.create({
        data: {
          id: randomUUID(),
          policyKey: previous?.policyKey ?? randomUUID(),
          version: (previous?.version ?? 0) + 1,
          previousVersionId: previous?.id,
          code: draft.code,
          name: draft.name,
          purpose: draft.purpose,
          dimensions: draft.dimensions,
          weights: draft.weights,
          thresholds: draft.thresholds,
          impedimentRules: draft.impedimentRules,
          authorizedSources: draft.authorizedSources,
          coverageMinimum: draft.coverageMinimum,
          effectiveFrom: day(draft.effectiveFrom),
          changeReason: draft.changeReason,
          createdBy: actorId,
          correlationId,
        },
      });

      await transaction.auditEvent.create({
        data: {
          id: randomUUID(),
          actorType: "USER",
          actorId,
          action: "INTELLIGENCE_POLICY_RECORDED",
          entityType: "INTELLIGENCE_POLICY",
          entityId: policy.id,
          correlationId,
          outcome: "SUCCESS",
          origin: "opportunity-intelligence",
          metadata: {
            policyKey: policy.policyKey,
            code: policy.code,
            version: policy.version,
            coverageMinimum: policy.coverageMinimum.toFixed(2),
          },
        },
      });
      return policy;
    });
  }

  async approvePolicy(id: string, draft: IntelligencePolicyApprovalDraft, actorId: string, correlationId: string) {
    return getDatabase().$transaction(async transaction => {
      const policy = await transaction.intelligencePolicy.findUnique({ where: { id } });
      if (!policy) throw new IntelligencePolicyNotFoundError("Política de inteligência não encontrada.");
      const latest = await transaction.intelligencePolicy.findFirst({
        where: { policyKey: policy.policyKey },
        orderBy: { version: "desc" },
      });
      if (latest?.id !== policy.id) throw new IntelligencePolicyRuleError("Somente a política mais recente pode ser aprovada.");
      if (policy.createdBy === actorId) throw new IntelligencePolicyRuleError("O autor não pode aprovar a própria política.");

      const approval = await transaction.intelligencePolicyApproval.create({
        data: {
          id: randomUUID(),
          policyId: id,
          note: draft.note,
          approvedAt: new Date(),
          approvedBy: actorId,
          correlationId,
        },
      });
      await transaction.auditEvent.create({
        data: {
          id: randomUUID(),
          actorType: "USER",
          actorId,
          action: "INTELLIGENCE_POLICY_APPROVED",
          entityType: "INTELLIGENCE_POLICY",
          entityId: id,
          correlationId,
          outcome: "SUCCESS",
          origin: "opportunity-intelligence",
          metadata: { approvalId: approval.id, policyKey: policy.policyKey, version: policy.version },
        },
      });
      return approval;
    });
  }
}
