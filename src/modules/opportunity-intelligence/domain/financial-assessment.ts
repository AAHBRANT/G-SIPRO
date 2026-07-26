import { createHash } from "node:crypto";

import { z } from "zod";

const dateSchema = z.iso.date();
const evidenceSchema = z.object({
  sourceType: z.string().trim().min(2).max(80),
  sourceReference: z.string().trim().min(2).max(500),
  sourceDate: dateSchema,
  documentHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
}).strict();

export const financialIndexSchema = z.object({
  code: z.string().trim().min(1).max(80).transform(value => value.toUpperCase()),
  name: z.string().trim().min(2).max(200),
  formulaDescription: z.string().trim().min(2).max(500),
  comparison: z.enum(["GTE", "LTE", "EQ"]),
  requiredLimit: z.number().finite(),
  actualValue: z.number().finite(),
  sourceReference: z.string().trim().min(2).max(500),
  sourceDate: dateSchema,
}).strict();

export const financialAssessmentDraftSchema = z.object({
  periodStart: dateSchema,
  periodEnd: dateSchema,
  indices: financialIndexSchema.array().max(100),
  conclusion: z.enum(["ADEQUATE", "HIGH_RISK", "INSUFFICIENT_DATA"]),
  justification: z.string().trim().min(20).max(5000),
  evidence: evidenceSchema.array().min(1).max(100),
  confirmedAt: z.iso.datetime({ offset: true }),
}).strict().superRefine((value, context) => {
  if (value.periodEnd < value.periodStart) {
    context.addIssue({ code: "custom", path: ["periodEnd"], message: "O fim do período deve ser posterior ao início." });
  }
  if (value.indices.length === 0 && value.conclusion !== "INSUFFICIENT_DATA") {
    context.addIssue({
      code: "custom",
      path: ["conclusion"],
      message: "Sem índices formais, a conclusão deve ser INSUFFICIENT_DATA.",
    });
  }
});

export type FinancialAssessmentDraft = z.infer<typeof financialAssessmentDraftSchema>;

const meetsRequirement = (comparison: "GTE" | "LTE" | "EQ", actual: number, limit: number) => {
  if (comparison === "GTE") return actual >= limit;
  if (comparison === "LTE") return actual <= limit;
  return actual === limit;
};

export function calculateFinancialAssessment(draft: FinancialAssessmentDraft) {
  const calculatedIndices = draft.indices.map(index => ({
    ...index,
    meetsRequirement: meetsRequirement(index.comparison, index.actualValue, index.requiredLimit),
  }));
  const failedIndices = calculatedIndices.filter(index => !index.meetsRequirement);
  const highIndebtednessRisk = draft.conclusion === "HIGH_RISK" || failedIndices.length > 0;
  const normalizedConclusion = highIndebtednessRisk
    ? "HIGH_RISK"
    : draft.conclusion;
  const snapshot = {
    ...draft,
    conclusion: normalizedConclusion,
    calculatedIndices,
    failedIndexCodes: failedIndices.map(index => index.code),
    highIndebtednessRisk,
  };
  return {
    ...snapshot,
    assessmentHash: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
  };
}
