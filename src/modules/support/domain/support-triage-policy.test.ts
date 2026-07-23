import { describe, expect, it } from "vitest";
import { supportApprovalPolicy } from "./support-triage-policy";

const diagnosis = { summary: "Falha confirmada", probableCause: "Validação incorreta", severity: "MEDIUM" as const, changeClass: "CORRECTION" as const, recommendedAction: "Corrigir validação", suggestedTests: ["Testar"], userGuidance: "Acompanhar", confidence: 0.8 };

describe("supportApprovalPolicy", () => {
  it("sends a pure bug correction directly to technical triage", () => expect(supportApprovalPolicy({ type: "BUG", priority: "NORMAL", title: "Falha ao acessar", description: "A tela apresenta erro ao abrir." }, diagnosis)).toMatchObject({ approvalRequired: false, status: "TRIAGED" }));
  it("sends a new feature to owner approval", () => expect(supportApprovalPolicy({ type: "NEW_FEATURE", priority: "NORMAL", title: "Novo relatório", description: "Criar um relatório adicional." }, diagnosis)).toMatchObject({ approvalRequired: true, status: "WAITING_APPROVAL" }));
  it("sends an improvement to owner approval", () => expect(supportApprovalPolicy({ type: "IMPROVEMENT", priority: "NORMAL", title: "Ajustar painel", description: "Ocultar informação desnecessária." }, diagnosis)).toMatchObject({ approvalRequired: true, status: "WAITING_APPROVAL" }));
  it("requests approval when diagnosis identifies a functional change", () => expect(supportApprovalPolicy({ type: "BUG", priority: "NORMAL", title: "Novo comportamento", description: "Alterar a regra existente do fluxo." }, { ...diagnosis, changeClass: "FUNCTIONAL_CHANGE" })).toMatchObject({ approvalRequired: true, status: "WAITING_APPROVAL" }));
});
