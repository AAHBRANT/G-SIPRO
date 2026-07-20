import { z } from "zod";

export const technicalSectionStatusSchema = z.enum(["DRAFT", "IN_PROGRESS", "IN_REVIEW", "COMPLETED"]);
export const technicalSectionDraftSchema = z.object({
  type: z.string().trim().min(2).max(80),
  title: z.string().trim().min(3).max(200),
  position: z.coerce.number().int().positive(),
  responsibleId: z.uuid(),
  requirementIds: z.array(z.uuid()).max(100).default([]),
}).strict();
export const technicalSectionUpdateSchema = z.object({
  responsibleId: z.uuid(),
  status: technicalSectionStatusSchema,
  version: z.coerce.number().int().positive(),
}).strict();

export type TechnicalSectionDraft = z.infer<typeof technicalSectionDraftSchema>;
export type TechnicalSectionUpdate = z.infer<typeof technicalSectionUpdateSchema>;
