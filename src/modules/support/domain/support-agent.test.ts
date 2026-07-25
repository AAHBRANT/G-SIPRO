import { describe, expect, it } from "vitest";
import { supportAgentCommandSchema, supportAgentFailureOutcome } from "./support-agent";

describe("support agent protocol", () => {
  it("requires a lease to finish an execution", () => {
    expect(supportAgentCommandSchema.safeParse({ action: "COMPLETE", executorId: "codex-runner", summary: "Corrigido", tests: ["Aprovado"] }).success).toBe(false);
  });

  it("accepts a complete result with validation evidence", () => {
    expect(supportAgentCommandSchema.safeParse({ action: "COMPLETE", executorId: "codex-runner", leaseId: crypto.randomUUID(), summary: "Corrigido", tests: ["Regressão aprovada"], revision: "abcdef1", deploymentUrl: "https://app.example.com" }).success).toBe(true);
  });

  it("accepts progress linked to a pull request", () => {
    expect(supportAgentCommandSchema.safeParse({ action: "REPORT_PROGRESS", executorId: "codex-runner", leaseId: crypto.randomUUID(), summary: "Correção proposta para revisão.", pullRequestUrl: "https://github.com/example/repo/pull/1" }).success).toBe(true);
  });

  it("accepts a controlled external blocker for the owner", () => {
    expect(supportAgentCommandSchema.safeParse({
      action: "REPORT_OWNER_ACTION",
      executorId: "codex-runner",
      leaseId: crypto.randomUUID(),
      category: "TEAMS",
      summary: "A publicação depende da política de aplicativos do Teams.",
      ownerAction: "Confirme a atribuição do aplicativo ao grupo autorizado.",
      securityGuidance: "Não amplie a política para toda a organização.",
    }).success).toBe(true);
  });

  it("accepts structured clarification without treating it as a failed attempt", () => {
    expect(supportAgentCommandSchema.safeParse({
      action: "REPORT_CLARIFICATION",
      executorId: "codex-runner",
      leaseId: crypto.randomUUID(),
      summary: "As mensagens do histórico são contraditórias.",
      clarification: {
        introduction: "Confirme o estado atual antes de uma nova correção.",
        questions: [{
          id: "q1",
          question: "O problema ainda ocorre ao repetir a operação?",
          options: ["Sim, continua ocorrendo", "Não, foi resolvido"],
        }],
      },
    }).success).toBe(true);
  });

  it("returns a failed first attempt to the autonomous queue", () => {
    expect(supportAgentFailureOutcome(1)).toEqual({ attempts: 1, exhausted: false, status: "TRIAGED" });
  });

  it("escalates a failed third attempt to the owner", () => {
    expect(supportAgentFailureOutcome(3)).toEqual({ attempts: 3, exhausted: true, status: "ESCALATED" });
  });
});
