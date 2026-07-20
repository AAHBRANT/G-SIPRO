import { z } from "zod";

const optionalNarrative = z.string().trim().min(10).max(2000).optional();

export const itemAssessmentSchema = z.object({
  decision: z.enum(["MEETS", "PARTIAL", "DOES_NOT_MEET", "NOT_APPLICABLE"]),
  justification: z.string().trim().min(10).max(4000),
  gapDescription: optionalNarrative,
  riskDescription: optionalNarrative,
  impact: optionalNarrative,
  treatment: optionalNarrative,
  responsibleId: z.uuid().optional(),
  dueAt: z.iso.datetime({ offset: true }).optional(),
}).strict().superRefine((value, context) => {
  const treatmentFields = [value.gapDescription, value.riskDescription, value.impact, value.treatment, value.responsibleId, value.dueAt];
  const informed = treatmentFields.filter(field => field !== undefined).length;
  if (informed !== 0 && informed !== treatmentFields.length) context.addIssue({ code: "custom", path: ["gapDescription"], message: "Lacuna, risco, impacto, tratamento, responsável e prazo devem ser informados juntos." });
  if ((value.decision === "PARTIAL" || value.decision === "DOES_NOT_MEET") && informed !== treatmentFields.length) context.addIssue({ code: "custom", path: ["gapDescription"], message: "Decisão parcial ou não atende exige o tratamento completo da lacuna." });
});

export type ItemAssessmentDraft = z.infer<typeof itemAssessmentSchema>;

