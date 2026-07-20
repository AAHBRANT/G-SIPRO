import type { SupportDiagnosis, SupportTicketInput } from "./support-ticket";

export function supportApprovalPolicy(input: SupportTicketInput, diagnosis: SupportDiagnosis) {
  const approvalRequired = input.type === "IMPROVEMENT" || input.type === "NEW_FEATURE" || diagnosis.changeClass !== "CORRECTION";
  const approvalReason = !approvalRequired ? null : diagnosis.changeClass === "NEW_TOOL"
    ? "Criação de nova ferramenta ou função."
    : "Alteração funcional ou de configuração sujeita à aprovação do usuário mestre.";
  return { approvalRequired, approvalReason, status: approvalRequired ? "WAITING_APPROVAL" as const : "TRIAGED" as const };
}
