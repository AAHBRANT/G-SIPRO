import { z } from "zod";

export const intelligenceNotificationDraftSchema = z.object({
  type: z.enum([
    "ANALYSIS_COMPLETED",
    "RECOMMENDATION_CHANGED",
    "INFORMATION_REQUESTED",
    "IMPEDIMENT_DETECTED",
    "OWNER_DECISION_REQUIRED",
    "DECISION_RECORDED",
  ]),
  opportunityId: z.uuid(),
  opportunityCode: z.string().trim().min(1).max(50),
  analysisId: z.uuid().optional(),
  analysisVersion: z.number().int().positive().optional(),
  recipientId: z.uuid(),
  summary: z.string().trim().min(5).max(500),
  nextAction: z.string().trim().min(5).max(500),
  deepLink: z.string().startsWith("/").max(500),
  recommendation: z.enum([
    "RECOMMENDED",
    "RECOMMENDED_WITH_RESTRICTIONS",
    "NOT_RECOMMENDED",
    "WAITING_INFORMATION",
    "WAITING_OWNER_DECISION",
  ]).optional(),
  status: z.enum([
    "QUEUED",
    "COLLECTING",
    "CALCULATING",
    "AI_EXPLAINING",
    "WAITING_INFORMATION",
    "WAITING_OWNER",
    "SUCCEEDED",
    "PARTIAL",
    "FAILED",
  ]).optional(),
}).strict();

export type IntelligenceNotificationDraft = z.infer<typeof intelligenceNotificationDraftSchema>;

export function planAnalysisNotifications(input: {
  opportunityId: string;
  opportunityCode: string;
  analysisId: string;
  analysisVersion: number;
  recipientId: string;
  previousRecommendation?: IntelligenceNotificationDraft["recommendation"] | null;
  recommendation?: IntelligenceNotificationDraft["recommendation"] | null;
  status: IntelligenceNotificationDraft["status"];
  pendingCount: number;
  hasCriticalImpediment: boolean;
}): IntelligenceNotificationDraft[] {
  const base = {
    opportunityId: input.opportunityId,
    opportunityCode: input.opportunityCode,
    analysisId: input.analysisId,
    analysisVersion: input.analysisVersion,
    recipientId: input.recipientId,
    deepLink: `/opportunities/${input.opportunityId}?analysis=${input.analysisId}`,
    ...(input.recommendation && { recommendation: input.recommendation }),
    status: input.status,
  };
  const drafts: IntelligenceNotificationDraft[] = [];
  if (input.hasCriticalImpediment) {
    drafts.push(intelligenceNotificationDraftSchema.parse({
      ...base,
      type: "IMPEDIMENT_DETECTED",
      summary: `Impedimento crítico identificado na oportunidade ${input.opportunityCode}.`,
      nextAction: "O proprietário deve abrir a análise e registrar a decisão empresarial.",
    }));
    drafts.push(intelligenceNotificationDraftSchema.parse({
      ...base,
      type: "OWNER_DECISION_REQUIRED",
      summary: `A oportunidade ${input.opportunityCode} aguarda decisão do proprietário.`,
      nextAction: "Revisar as evidências e decidir se a oportunidade deve prosseguir.",
    }));
  } else if (input.pendingCount > 0 || input.status === "WAITING_INFORMATION") {
    drafts.push(intelligenceNotificationDraftSchema.parse({
      ...base,
      type: "INFORMATION_REQUESTED",
      summary: `A análise da oportunidade ${input.opportunityCode} precisa de informações.`,
      nextAction: "Abrir a análise, consultar as pendências e completar os dados solicitados.",
    }));
  } else {
    drafts.push(intelligenceNotificationDraftSchema.parse({
      ...base,
      type: "ANALYSIS_COMPLETED",
      summary: `Nova análise concluída para a oportunidade ${input.opportunityCode}.`,
      nextAction: "Abrir o painel analítico e revisar o resultado.",
    }));
  }
  if (
    input.previousRecommendation
    && input.recommendation
    && input.previousRecommendation !== input.recommendation
  ) {
    drafts.push(intelligenceNotificationDraftSchema.parse({
      ...base,
      type: "RECOMMENDATION_CHANGED",
      summary: `A recomendação da oportunidade ${input.opportunityCode} foi atualizada.`,
      nextAction: "Comparar a nova versão com a análise anterior.",
    }));
  }
  return drafts;
}
