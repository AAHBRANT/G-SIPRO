import { describe, expect, it } from "vitest";
import { supportProgress } from "./support-progress";

describe("supportProgress", () => {
  it("confirms an automatic retry without another approval", () => {
    expect(supportProgress({ status: "TRIAGED", executionAttempts: 1, resolutionAttempts: 0, updatedAt: "2026-07-21T20:00:00Z" })).toMatchObject({
      attempt: 2,
      headline: "Nova tentativa programada",
      stage: 2,
    });
  });

  it("shows when the AI is working and what happens next", () => {
    const progress = supportProgress({ status: "IN_PROGRESS", executionAttempts: 2, resolutionAttempts: 1, updatedAt: "2026-07-21T20:00:00Z" });
    expect(progress.headline).toContain("tentativa 2 de 3");
    expect(progress.nextStep).toContain("implantação");
  });

  it("hands off only after the third completed attempt", () => {
    expect(supportProgress({ status: "ESCALATED", executionAttempts: 3, resolutionAttempts: 0, updatedAt: "2026-07-21T20:00:00Z" })).toMatchObject({ attempt: 3, tone: "rose" });
  });

  it("shows owner approval as the next required action", () => {
    expect(supportProgress({ status: "WAITING_APPROVAL", executionAttempts: 0, resolutionAttempts: 0, updatedAt: "2026-07-21T20:00:00Z" })).toMatchObject({ attempt: 1, tone: "amber", headline: "Aguardando aprovação do proprietário" });
  });

  it("shows a controlled owner action without pretending the ticket is solved", () => {
    expect(supportProgress({ status: "OWNER_ACTION_REQUIRED", executionAttempts: 1, resolutionAttempts: 0, updatedAt: "2026-07-23T15:00:00Z" })).toMatchObject({
      attempt: 1, tone: "amber", headline: "Ação do proprietário necessária",
    });
  });
});
