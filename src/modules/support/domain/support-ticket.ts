import { z } from "zod";

export const supportTicketInputSchema = z.object({
  type: z.enum(["BUG", "QUESTION", "IMPROVEMENT", "NEW_FEATURE"]),
  priority: z.enum(["NORMAL", "HIGH", "CRITICAL"]).default("NORMAL"),
  title: z.string().trim().min(5).max(200),
  description: z.string().trim().min(10).max(10_000),
  pagePath: z.string().trim().max(500).optional(),
  errorMessage: z.string().trim().max(5_000).optional(),
  stepsToReproduce: z.string().trim().max(5_000).optional(),
  clientContext: z.record(z.string(), z.string().max(1_000)).optional(),
});

export const supportDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().min(3).max(1_000),
});

export const supportStatusSchema = z.object({
  status: z.enum(["IN_PROGRESS", "RESOLVED", "CANCELLED"]),
  note: z.string().trim().min(3).max(2_000),
});

export const supportMessageSchema = z.object({
  message: z.string().trim().min(1).max(2_000),
});

export const supportReopenSchema = z.object({
  note: z.string().trim().min(3).max(2_000),
});

export const supportDiagnosisSchema = z.object({
  summary: z.string().trim().min(1).max(1_500),
  probableCause: z.string().trim().min(1).max(2_500),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  changeClass: z.enum(["CORRECTION", "CONFIGURATION", "FUNCTIONAL_CHANGE", "NEW_TOOL"]),
  recommendedAction: z.string().trim().min(1).max(2_500),
  suggestedTests: z.array(z.string().trim().min(1).max(500)).max(12),
  userGuidance: z.string().trim().min(1).max(1_500),
  confidence: z.number().min(0).max(1),
});

export type SupportTicketInput = z.infer<typeof supportTicketInputSchema>;
export type SupportDiagnosis = z.infer<typeof supportDiagnosisSchema>;
