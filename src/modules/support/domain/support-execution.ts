import { z } from "zod";

export const supportExecutionCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CLAIM") }),
  z.object({
    action: z.literal("COMPLETE"),
    summary: z.string().trim().min(3).max(2_000),
    tests: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
    revision: z.string().trim().min(7).max(200),
    deploymentUrl: z.url().max(1_000),
  }),
  z.object({
    action: z.literal("REPORT_FAILURE"),
    summary: z.string().trim().min(3).max(2_000),
  }),
]);

export type SupportExecutionCommand = z.infer<typeof supportExecutionCommandSchema>;

export function supportExecutionAuthorization(ticket: { status: string; approvalRequired: boolean }) {
  const ready = (ticket.status === "TRIAGED" && !ticket.approvalRequired) || ticket.status === "APPROVED";
  const claimed = ticket.status === "IN_PROGRESS";
  const completed = ticket.status === "RESOLVED";
  return { ready, claimed, completed, allowed: ready || claimed || completed };
}

export function supportExecutionResolution(input: Extract<SupportExecutionCommand, { action: "COMPLETE" }>) {
  const lines = [
    input.summary,
    "",
    "Validações executadas:",
    ...input.tests.map((test) => `- ${test}`),
  ];
  if (input.revision) lines.push("", `Revisão: ${input.revision}`);
  if (input.deploymentUrl) lines.push(`Ambiente: ${input.deploymentUrl}`);
  return lines.join("\n");
}
