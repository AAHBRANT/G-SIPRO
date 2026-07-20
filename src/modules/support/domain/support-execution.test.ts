import { describe, expect, it } from "vitest";
import { supportExecutionAuthorization, supportExecutionResolution } from "./support-execution";

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
    expect(supportExecutionResolution({ action: "COMPLETE", summary: "Correção implantada.", tests: ["Teste de regressão aprovado"], revision: "rev-1" }))
      .toContain("Teste de regressão aprovado");
  });
});
