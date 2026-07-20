import { z } from "zod";

export const deadlineSchema = z.object({
  tenderId: z.uuid(),
  requirementId: z.uuid().optional(),
  event: z.string().trim().min(1).max(200),
  dueAt: z.coerce.date(),
  timeZone: z.string().trim().min(1).max(80),
  source: z.string().trim().min(1).max(500),
  critical: z.boolean().default(false),
  responsibleId: z.uuid(),
  alerts: z.array(z.coerce.date()).max(20).default([]),
}).superRefine((value, context) => {
  for (const alert of value.alerts) if (alert >= value.dueAt) context.addIssue({ code: "custom", path: ["alerts"], message: "O alerta deve ocorrer antes do prazo." });
});

export const confirmDeadlineSchema = z.object({ reason: z.string().trim().min(10).max(1000) });
export type DeadlineDraft = z.infer<typeof deadlineSchema>;
