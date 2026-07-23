import type { SupportDiagnosis, SupportTicketInput } from "./support-ticket";

export function supportApprovalPolicy(input: SupportTicketInput, diagnosis: SupportDiagnosis) {
  const ownerActionRequired = diagnosis.changeClass === "CONFIGURATION"
    && diagnosis.requiredActor === "OWNER"
    && diagnosis.ownerActionCategory
    && diagnosis.requiredAction
    && diagnosis.securityGuidance;
  if (ownerActionRequired) {
    return {
      approvalRequired: false,
      approvalReason: null,
      status: "OWNER_ACTION_REQUIRED" as const,
      externalBlocker: {
        category: diagnosis.ownerActionCategory,
        summary: diagnosis.summary,
        ownerAction: diagnosis.requiredAction,
        securityGuidance: diagnosis.securityGuidance,
        reportedBy: "triagem-inteligente",
      },
    };
  }
  const requestedChange = input.type === "IMPROVEMENT" || input.type === "NEW_FEATURE";
  const diagnosedChange = ["CONFIGURATION", "FUNCTIONAL_CHANGE", "NEW_TOOL"].includes(diagnosis.changeClass);
  if (requestedChange || diagnosedChange) {
    const approvalReason = input.type === "NEW_FEATURE" || diagnosis.changeClass === "NEW_TOOL"
      ? "Nova ferramenta ou capacidade: exige aprovação do proprietário antes da execução automática."
      : "Melhoria ou alteração funcional: exige aprovação do proprietário antes da execução automática.";
    return { approvalRequired: true, approvalReason, status: "WAITING_APPROVAL" as const, externalBlocker: null };
  }
  return { approvalRequired: false, approvalReason: null, status: "TRIAGED" as const, externalBlocker: null };
}
