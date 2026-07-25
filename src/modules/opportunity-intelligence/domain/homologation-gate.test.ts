import { describe, expect, it } from "vitest";
import {
  evaluateHomologationGate,
  homologationAreas,
  type HomologationCheck,
} from "./homologation-gate";

function passingChecks(): HomologationCheck[] {
  return homologationAreas.map((area) => ({
    area,
    status: "PASS",
    evidence: `Evidência ${area}`,
  }));
}

describe("evaluateHomologationGate", () => {
  it("aprova apenas com todas as áreas aprovadas e aprovação do proprietário", () => {
    expect(
      evaluateHomologationGate({
        checks: passingChecks(),
        ownerApproval: true,
      }).status,
    ).toBe("APPROVED");
  });

  it("aguarda o proprietário quando todas as evidências técnicas passaram", () => {
    expect(
      evaluateHomologationGate({
        checks: passingChecks(),
        ownerApproval: false,
      }).status,
    ).toBe("WAITING_OWNER_APPROVAL");
  });

  it("bloqueia a homologação quando uma área está bloqueada ou ausente", () => {
    const checks = passingChecks()
      .filter(({ area }) => area !== "AUTHORIZED_REAL_SCENARIOS")
      .map((check) =>
        check.area === "ACCESSIBILITY"
          ? { ...check, status: "BLOCKED" as const }
          : check,
      );

    const gate = evaluateHomologationGate({
      checks,
      ownerApproval: true,
    });

    expect(gate.status).toBe("BLOCKED");
    expect(gate.blockedAreas).toEqual([
      "ACCESSIBILITY",
      "AUTHORIZED_REAL_SCENARIOS",
    ]);
  });

  it("rejeita antes de considerar bloqueios ou aprovação humana quando há falha", () => {
    const checks = passingChecks().map((check) =>
      check.area === "SECURITY"
        ? { ...check, status: "FAIL" as const }
        : check,
    );

    const gate = evaluateHomologationGate({
      checks,
      ownerApproval: true,
    });

    expect(gate.status).toBe("REJECTED");
    expect(gate.failedAreas).toEqual(["SECURITY"]);
  });
});
