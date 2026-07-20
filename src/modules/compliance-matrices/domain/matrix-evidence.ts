import { z } from "zod";

const comparisonSchema = z.object({
  executedQuantityId: z.uuid(),
  requiredValue: z.coerce.number().nonnegative().max(1e12),
  requiredUnit: z.string().trim().min(1).max(40),
  conversionFactor: z.coerce.number().positive().max(1e9).optional(),
  conversionRule: z.string().trim().min(10).max(2000).optional(),
  conversionSource: z.string().trim().min(1).max(500).optional(),
}).strict().superRefine((value, context) => {
  const conversionFields = [value.conversionFactor, value.conversionRule, value.conversionSource];
  const informed = conversionFields.filter(field => field !== undefined).length;
  if (informed !== 0 && informed !== conversionFields.length) context.addIssue({ code: "custom", path: ["conversionFactor"], message: "Fator, regra e fonte de conversão devem ser informados juntos." });
});

export const matrixEvidenceSchema = z.object({
  technicalEvidenceId: z.uuid(),
  locator: z.string().trim().min(1).max(500),
  justification: z.string().trim().min(10).max(1000),
  comparisons: z.array(comparisonSchema).max(20).default([]),
}).strict();

export type MatrixEvidenceDraft = z.infer<typeof matrixEvidenceSchema>;

