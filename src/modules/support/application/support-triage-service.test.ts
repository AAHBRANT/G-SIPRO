import { describe, expect, it } from "vitest";
import { fallbackDiagnosis, triageNote } from "./support-triage-service";
import { supportApprovalPolicy } from "../domain/support-triage-policy";
import { supportDiagnosisSchema, type SupportTicketInput } from "../domain/support-ticket";

const bug: SupportTicketInput = {
  type: "BUG",
  priority: "NORMAL",
  title: "Falha ao salvar",
  description: "O botão não conclui a operação.",
};

describe("fallbackDiagnosis", () => {
  it("produces a diagnosis that satisfies the domain schema", () => {
    expect(() => supportDiagnosisSchema.parse(fallbackDiagnosis(bug))).not.toThrow();
  });

  it("keeps a plain bug on the automatic queue instead of demanding approval", () => {
    const policy = supportApprovalPolicy(bug, fallbackDiagnosis(bug));
    expect(policy.status).toBe("TRIAGED");
    expect(policy.approvalRequired).toBe(false);
  });

  it("routes a new feature to owner approval", () => {
    const feature = { ...bug, type: "NEW_FEATURE" } as SupportTicketInput;
    const policy = supportApprovalPolicy(feature, fallbackDiagnosis(feature));
    expect(policy.status).toBe("WAITING_APPROVAL");
    expect(policy.approvalRequired).toBe(true);
  });

  it("never claims owner action, since the fallback has no evidence for it", () => {
    const diagnosis = fallbackDiagnosis(bug);
    expect(diagnosis.requiredActor).not.toBe("OWNER");
    expect(diagnosis.ownerActionCategory).toBeNull();
  });

  it("signals low confidence so it is not mistaken for a real diagnosis", () => {
    expect(fallbackDiagnosis(bug).confidence).toBeLessThan(0.5);
  });
});

describe("triageNote", () => {
  it("mentions intelligence when a model answered", () => {
    expect(triageNote(false, "gemma4:12b")).toContain("assistida por inteligência");
  });

  it("does not claim intelligence when the fallback ran", () => {
    const note = triageNote(false, undefined);
    expect(note).not.toContain("assistida por inteligência");
    expect(note).toContain("ainda será realizado");
  });

  it("explains the owner redirect regardless of the model", () => {
    expect(triageNote(true, "gemma4:12b")).toContain("exclusiva do proprietário");
    expect(triageNote(true, undefined)).toContain("exclusiva do proprietário");
  });
});
