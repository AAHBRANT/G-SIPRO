import { z } from "zod";

export const requirementCriticalities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const requirementStatuses = ["DRAFT", "PENDING_VALIDATION", "VALIDATED", "REJECTED"] as const;

export const requirementSchema = z.object({
  tenderVersionId: z.uuid(),
  type: z.string().trim().min(1).max(80),
  text: z.string().trim().min(1).max(20_000),
  criticality: z.enum(requirementCriticalities),
  responsibleId: z.uuid(),
  sourceExcerpt: z.string().trim().min(1).max(20_000),
  sourcePage: z.coerce.number().int().positive().max(100_000),
});

export const requirementPatchSchema = requirementSchema.omit({ tenderVersionId: true }).partial().refine(
  (value) => Object.keys(value).length > 0,
  "Informe ao menos um campo para alteração.",
);
export const requirementValidationSchema = z.object({ justification: z.string().trim().min(10).max(1000) }).strict();

export type RequirementDraft = z.infer<typeof requirementSchema>;
export type RequirementPatch = z.infer<typeof requirementPatchSchema>;
