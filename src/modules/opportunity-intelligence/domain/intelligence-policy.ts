import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const percentage = z.number().min(0).max(100);

export const intelligenceWeightsSchema = z.object({
  commercial: z.number().positive().max(100),
  technical: z.number().positive().max(100),
  studies: z.number().positive().max(100),
}).refine(
  value => Math.abs(value.commercial + value.technical + value.studies - 100) < 0.0001,
  { message: "A soma dos pesos deve ser exatamente 100." },
);

export const intelligenceThresholdsSchema = z.object({
  recommendedMinimum: percentage,
  restrictionsMinimum: percentage,
  minimumConfidence: percentage,
}).refine(
  value => value.recommendedMinimum > value.restrictionsMinimum,
  { message: "A faixa recomendada deve ser superior à faixa com ressalvas." },
);

export const intelligenceDimensionSchema = z.object({
  perspective: z.enum(["COMMERCIAL", "TECHNICAL", "STUDIES"]),
  code: text(120).transform(value => value.toUpperCase()),
  name: text(200),
  critical: z.boolean().default(false),
});

export const intelligenceImpedimentRuleSchema = z.object({
  type: z.enum(["HIGH_INDEBTEDNESS_RISK", "NON_PAYING_CUSTOMER"]),
  enabled: z.literal(true),
  description: text(1000),
});

export const intelligencePolicySchema = z.object({
  previousPolicyId: z.uuid().optional(),
  code: text(80).transform(value => value.toUpperCase()),
  name: text(200),
  purpose: text(1000),
  dimensions: z.array(intelligenceDimensionSchema).min(3).max(50),
  weights: intelligenceWeightsSchema,
  thresholds: intelligenceThresholdsSchema,
  impedimentRules: z.array(intelligenceImpedimentRuleSchema).length(2),
  authorizedSources: z.array(text(160)).min(1).max(50),
  coverageMinimum: percentage.refine(value => value === 70, "A cobertura mínima aprovada para o T0 é 70%."),
  effectiveFrom: z.iso.date(),
  changeReason: text(1000),
}).superRefine((value, context) => {
  const perspectives = new Set(value.dimensions.map(dimension => dimension.perspective));
  for (const perspective of ["COMMERCIAL", "TECHNICAL", "STUDIES"] as const) {
    if (!perspectives.has(perspective)) {
      context.addIssue({ code: "custom", path: ["dimensions"], message: `A perspectiva ${perspective} é obrigatória.` });
    }
  }
  if (new Set(value.impedimentRules.map(rule => rule.type)).size !== value.impedimentRules.length) {
    context.addIssue({ code: "custom", path: ["impedimentRules"], message: "As regras de impedimento não podem ser duplicadas." });
  }
});

export const intelligencePolicyApprovalSchema = z.object({
  note: z.string().trim().min(10).max(1000),
});

export type IntelligencePolicyDraft = z.infer<typeof intelligencePolicySchema>;
export type IntelligencePolicyApprovalDraft = z.infer<typeof intelligencePolicyApprovalSchema>;
