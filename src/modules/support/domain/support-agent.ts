import { z } from "zod";

const executorId = z.string().trim().min(3).max(160);
const leaseId = z.uuid();

export const supportAgentCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CLAIM"), executorId }),
  z.object({ action: z.literal("HEARTBEAT"), executorId, leaseId }),
  z.object({
    action: z.literal("COMPLETE"), executorId, leaseId,
    summary: z.string().trim().min(3).max(2_000),
    tests: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
    revision: z.string().trim().min(7).max(200),
    deploymentUrl: z.url().max(1_000),
  }),
  z.object({
    action: z.literal("REPORT_FAILURE"), executorId, leaseId,
    summary: z.string().trim().min(3).max(2_000),
  }),
  z.object({
    action: z.literal("REPORT_PROGRESS"), executorId, leaseId,
    summary: z.string().trim().min(3).max(2_000),
    pullRequestUrl: z.url().max(1_000).optional(),
    revision: z.string().trim().max(200).optional(),
  }),
]);

export type SupportAgentCommand = z.infer<typeof supportAgentCommandSchema>;
