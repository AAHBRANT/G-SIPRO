import { describe, expect, it } from "vitest";
import { supportExecutionAuthorization, supportExecutionCommandSchema, supportExecutionResolution } from "./support-execution";

describe("support execution bridge", () => {
  it("queues a diagnosed correction without extra approval", () => {
    expect(supportExecutionAuthorization({ status: "TRIAGED", approvalRequired: false })).toMatchObject({ ready: true, allowed: true });
  });

  it("blocks a functional change while approval is pending", () => {
    expect(supportExecutionAuthorization({ status: "WAITING_APPROVAL", approvalRequired: true })).toMatchObject({ ready: false, allowed: false });
  });

  it("queues an approved change", () => {
    expect(supportExecutionAuthorization({ status: "APPROVED", approvalRequired: true })).toMatchObject({ ready: true, allowed: true });
  });

  it("builds a human-readable resolution with validation evidence", () => {
    expect(supportExecutionResolution({ action: "COMPLETE", summary: "Correção implantada.", tests: ["Teste de regressão aprovado"], revision: "abcdef1", deploymentUrl: "https://app.example.com" }))
      .toContain("Teste de regressão aprovado");
  });

  it("recusa conclusão sem revisão e ambiente publicado", () => {
    expect(supportExecutionCommandSchema.safeParse({ action: "COMPLETE", summary: "Concluído", tests: ["Teste aprovado"] }).success).toBe(false);
  });
});
