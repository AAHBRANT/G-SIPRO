export const SUPPORT_EXECUTION_LEASE_MINUTES = 20;

export function supportStatusAfterExpiredLease(input: {
  type: "BUG" | "QUESTION" | "IMPROVEMENT" | "NEW_FEATURE";
  executionAttempts: number;
}): "TRIAGED" | "APPROVED" | "ESCALATED" {
  if (input.executionAttempts >= 3) return "ESCALATED";
  return input.type === "IMPROVEMENT" || input.type === "NEW_FEATURE" ? "APPROVED" : "TRIAGED";
}

export function supportLeaseCutoff(now = new Date()): Date {
  return new Date(now.getTime() - SUPPORT_EXECUTION_LEASE_MINUTES * 60_000);
}
