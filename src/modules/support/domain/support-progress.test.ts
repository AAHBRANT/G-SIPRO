import { describe, expect, it } from "vitest";
import { supportProgress } from "./support-progress";

describe("supportProgress", () => {
  it("confirms an automatic retry without another approval", () => {
    expect(supportProgress({ status: "TRIAGED", resolutionAttempts: 1, updatedAt: "2026-07-21T20:00:00Z" })).toMatchObject({
      attempt: 2,
      headline: "Reabertura aceita",
      stage: 2,
    });
  });

  it("shows when the AI is working and what happens next", () => {
    const progress = supportProgress({ status: "IN_PROGRESS", resolutionAttempts: 1, updatedAt: "2026-07-21T20:00:00Z" });
    expect(progress.headline).toContain("tentativa 2 de 3");
    expect(progress.nextStep).toContain("implantação");
  });

  it("hands off only after the third completed attempt", () => {
    expect(supportProgress({ status: "ESCALATED", resolutionAttempts: 3, updatedAt: "2026-07-21T20:00:00Z" })).toMatchObject({ attempt: 3, tone: "rose" });
  });
});
