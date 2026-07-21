import type { SupportDiagnosis, SupportTicketInput } from "./support-ticket";

export function supportApprovalPolicy(input: SupportTicketInput, diagnosis: SupportDiagnosis) {
  void input;
  void diagnosis;
  return { approvalRequired: false, approvalReason: null, status: "TRIAGED" as const };
}
