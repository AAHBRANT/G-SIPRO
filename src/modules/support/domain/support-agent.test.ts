import { describe, expect, it } from "vitest";
import { supportAgentCommandSchema } from "./support-agent";

describe("support agent protocol", () => {
  it("requires a lease to finish an execution", () => {
    expect(supportAgentCommandSchema.safeParse({ action: "COMPLETE", executorId: "codex-runner", summary: "Corrigido", tests: ["Aprovado"] }).success).toBe(false);
  });

  it("accepts a complete result with validation evidence", () => {
    expect(supportAgentCommandSchema.safeParse({ action: "COMPLETE", executorId: "codex-runner", leaseId: crypto.randomUUID(), summary: "Corrigido", tests: ["Regressão aprovada"] }).success).toBe(true);
  });
});
