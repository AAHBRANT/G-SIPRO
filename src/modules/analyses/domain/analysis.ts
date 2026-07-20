import { z } from "zod";

export const competenceValues = ["TECHNICAL", "LEGAL", "COMMERCIAL", "FINANCIAL", "ACCOUNTING"] as const;
export const priorityValues = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;

export const analysisSchema = z.object({
  requirementId: z.uuid(),
  competence: z.enum(competenceValues),
  priority: z.enum(priorityValues).default("NORMAL"),
  assigneeId: z.uuid(),
});
export const analysisDecisionSchema = z.object({
  decision: z.enum(["VALIDATED", "REJECTED"]),
  justification: z.string().trim().min(10).max(1000),
});
export const analysisReassignmentSchema = z.object({
  assigneeId: z.uuid(),
  reason: z.string().trim().min(10).max(1000),
});

export type AnalysisDraft = z.infer<typeof analysisSchema>;
