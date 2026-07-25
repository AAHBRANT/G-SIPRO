import { randomUUID } from "node:crypto";

import { getDatabase } from "@/core/database/prisma";
import { ResourceNotFoundError } from "@/core/errors/application-error";
import type {
  OpportunityAnalysisDecisionRepository,
  opportunityAnalysisDecisionSchema,
} from "../application/opportunity-analysis-decision-service";
import { intelligenceNotificationDraftSchema } from "../domain/intelligence-notification";
import { enqueueIntelligenceNotifications } from "./prisma-notification-outbox";
import type { z } from "zod";

type Decision = z.infer<typeof opportunityAnalysisDecisionSchema>;

export class PrismaOpportunityAnalysisDecisionRepository implements OpportunityAnalysisDecisionRepository {
  async findContext(analysisId: string) {
    const analysis = await getDatabase().opportunityAnalysis.findUnique({
      where: { id: analysisId },
      select: {
        recommendation: true,
        impediments: { where: { status: "OPEN" }, select: { id: true }, take: 1 },
      },
    });
    return analysis && {
      recommendation: analysis.recommendation,
      hasOpenImpediment: analysis.impediments.length > 0,
    };
  }

  async decide(analysisId: string, decision: Decision, actorId: string, correlationId: string) {
    return getDatabase().$transaction(async transaction => {
      const analysis = await transaction.opportunityAnalysis.findUnique({
        where: { id: analysisId },
        include: {
          impediments: { where: { status: "OPEN" }, orderBy: { detectedAt: "asc" } },
          opportunity: { select: { id: true, code: true, ownerId: true } },
        },
      });
      if (!analysis) throw new ResourceNotFoundError("Análise de oportunidade não encontrada.");
      const record = await transaction.opportunityAnalysisDecision.create({
        data: {
          id: randomUUID(),
          analysisId,
          decision: decision.decision,
          justification: decision.justification,
          observedRecommendation: analysis.recommendation,
          observedImpediments: analysis.impediments.map(impediment => ({
            id: impediment.id,
            type: impediment.type,
            ruleCode: impediment.ruleCode,
            severity: impediment.severity,
            detectedAt: impediment.detectedAt,
          })),
          decidedBy: actorId,
          correlationId,
        },
      });
      if (analysis.impediments.length > 0) {
        await transaction.criticalImpediment.updateMany({
          where: { analysisId, status: "OPEN" },
          data: { status: "DECIDED" },
        });
      }
      await transaction.opportunityAnalysis.update({
        where: { id: analysisId },
        data: { status: "SUCCEEDED", completedAt: new Date() },
      });
      await enqueueIntelligenceNotifications(
        transaction,
        [intelligenceNotificationDraftSchema.parse({
          type: "DECISION_RECORDED",
          opportunityId: analysis.opportunity.id,
          opportunityCode: analysis.opportunity.code,
          analysisId,
          analysisVersion: analysis.version,
          recipientId: analysis.opportunity.ownerId ?? analysis.requestedBy,
          summary: `Decisão registrada para a oportunidade ${analysis.opportunity.code}.`,
          nextAction: "Consultar a decisão e seguir o encaminhamento empresarial registrado.",
          deepLink: `/opportunities/${analysis.opportunity.id}?analysis=${analysisId}`,
          recommendation: analysis.recommendation ?? undefined,
          status: "SUCCEEDED",
        })],
        correlationId,
      );
      await transaction.auditEvent.create({
        data: {
          id: randomUUID(),
          actorType: "USER",
          actorId,
          action: "OPPORTUNITY_ANALYSIS_DECISION_RECORDED",
          entityType: "OPPORTUNITY_ANALYSIS",
          entityId: analysisId,
          correlationId,
          outcome: "SUCCESS",
          origin: "opportunity-intelligence",
          metadata: {
            decision: record.decision,
            observedRecommendation: record.observedRecommendation,
            openImpedimentCount: analysis.impediments.length,
          },
        },
      });
      return transaction.opportunityAnalysisDecision.findUniqueOrThrow({ where: { id: record.id } });
    });
  }
}
