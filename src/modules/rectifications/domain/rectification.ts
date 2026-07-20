import { z } from "zod";

export const rectificationSchema = z.object({
  tenderId: z.uuid(),
  previousVersionId: z.uuid(),
  rectifiedByVersionId: z.uuid(),
  description: z.string().trim().min(10).max(1000),
  source: z.string().trim().min(1).max(500),
  impacts: z.array(z.object({ requirementId: z.uuid(), description: z.string().trim().min(10).max(1000), requiresRevalidation: z.boolean().default(true) })).min(1).max(100),
}).superRefine((value, context) => {
  if (value.previousVersionId === value.rectifiedByVersionId) context.addIssue({ code: "custom", path: ["rectifiedByVersionId"], message: "A retificação deve gerar uma nova versão documental." });
  if (new Set(value.impacts.map((impact) => impact.requirementId)).size !== value.impacts.length) context.addIssue({ code: "custom", path: ["impacts"], message: "Um requisito não pode ser repetido na mesma retificação." });
});
export type RectificationDraft = z.infer<typeof rectificationSchema>;
