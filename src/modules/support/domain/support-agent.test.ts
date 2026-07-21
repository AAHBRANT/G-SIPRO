import { describe, expect, it } from "vitest";
import { supportAgentCommandSchema } from "./support-agent";

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
});
