import { randomUUID } from "node:crypto";
import { getDatabase } from "@/core/database/prisma";
import { RectificationRuleError, type RectificationRepository } from "@/modules/rectifications/application/rectification-service";
import type { RectificationDraft } from "@/modules/rectifications/domain/rectification";

export class PrismaRectificationRepository implements RectificationRepository {
  async create(draft: RectificationDraft, actorId: string, correlationId: string) {
    return getDatabase().$transaction(async (tx) => {
      const versions = await tx.tenderVersion.findMany({ where: { id: { in: [draft.previousVersionId, draft.rectifiedByVersionId] }, tenderId: draft.tenderId }, select: { id: true, version: true } });
      if (versions.length !== 2) throw new RectificationRuleError("As duas versões documentais devem pertencer ao edital informado.");
      const previous = versions.find((version) => version.id === draft.previousVersionId)!;
      const rectified = versions.find((version) => version.id === draft.rectifiedByVersionId)!;
      if (rectified.version <= previous.version) throw new RectificationRuleError("A versão retificadora deve ser posterior à versão retificada.");
      const requirements = await tx.tenderRequirement.findMany({ where: { id: { in: draft.impacts.map((impact) => impact.requirementId) }, tenderVersion: { tenderId: draft.tenderId } }, select: { id: true } });
      if (requirements.length !== draft.impacts.length) throw new RectificationRuleError("Todo requisito impactado deve pertencer ao edital informado.");
      const created = await tx.tenderRectification.create({ data: { id: randomUUID(), tenderId: draft.tenderId, previousVersionId: draft.previousVersionId, rectifiedByVersionId: draft.rectifiedByVersionId, description: draft.description, source: draft.source, createdBy: actorId, impacts: { create: draft.impacts.map((impact) => ({ id: randomUUID(), ...impact, createdBy: actorId })) } } });
      let reopenedAnalyses = 0;
      for (const impact of draft.impacts.filter((item) => item.requiresRevalidation)) {
        const analyses = await tx.requirementAnalysis.findMany({ where: { requirementId: impact.requirementId, status: { not: "PENDING" } } });
        for (const analysis of analyses) {
          const nextVersion = analysis.version + 1;
          const changed = await tx.requirementAnalysis.updateMany({ where: { id: analysis.id, version: analysis.version, status: analysis.status }, data: { status: "PENDING", justification: null, decidedAt: null, decidedById: null, version: nextVersion, updatedBy: actorId } });
          if (changed.count !== 1) throw new RectificationRuleError("Uma análise impactada foi alterada concorrentemente.");
          await tx.analysisHistory.create({ data: { id: randomUUID(), analysisId: analysis.id, version: nextVersion, action: "REOPENED_BY_RECTIFICATION", changes: { status: { from: analysis.status, to: "PENDING" }, rectificationId: created.id }, reason: impact.description, changedById: actorId, correlationId } });
          await tx.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId, action: "ANALYSIS_REOPENED_BY_RECTIFICATION", entityType: "REQUIREMENT_ANALYSIS", entityId: analysis.id, correlationId, outcome: "SUCCESS", origin: "rectification-service", metadata: { rectificationId: created.id, requirementId: impact.requirementId } } });
          reopenedAnalyses++;
        }
      }
      await tx.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId, action: "RECTIFICATION_CREATED", entityType: "TENDER_RECTIFICATION", entityId: created.id, correlationId, outcome: "SUCCESS", origin: "rectification-service", metadata: { impacts: draft.impacts.length, reopenedAnalyses } } });
      return { id: created.id, tenderId: created.tenderId, previousVersionId: created.previousVersionId, rectifiedByVersionId: created.rectifiedByVersionId, impacts: draft.impacts.length, reopenedAnalyses };
    });
  }
}
