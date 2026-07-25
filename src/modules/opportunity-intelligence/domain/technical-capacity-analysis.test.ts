import { describe, expect, it } from "vitest";

import { calculateTechnicalCapacity } from "./technical-capacity-analysis";

const ids = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
];

const item = (criticality: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL", decision?: "MEETS" | "PARTIAL" | "DOES_NOT_MEET") => ({
  id: ids[0]!,
  requirementId: ids[1]!,
  requirementVersion: 1,
  requirementText: "Comprovar experiência técnica compatível.",
  criticality,
  sourcePage: 12,
  ...(decision && {
    assessment: {
      id: ids[2]!,
      version: 1,
      decision,
      justification: "Parecer técnico validado com base no acervo.",
      evidenceCount: decision === "DOES_NOT_MEET" ? 0 : 1,
      validatedAt: new Date("2026-07-24T12:00:00.000Z"),
    },
  }),
});

describe("technical capacity analysis", () => {
  it("requires every critical requirement to be fully met", () => {
    const result = calculateTechnicalCapacity(
      { matrixId: ids[3], matrixVersion: 1, matrixStatus: "VALIDATED", items: [item("CRITICAL", "PARTIAL")] },
      [{ code: "OPERATIONAL_CAPACITY" }],
      40,
    );
    expect(result.hasUnresolvedCritical).toBe(true);
    expect(result.hasCriticalFailure).toBe(false);
  });

  it("marks an explicit critical failure without hiding its zero score", () => {
    const result = calculateTechnicalCapacity(
      { matrixId: ids[3], matrixVersion: 1, matrixStatus: "VALIDATED", items: [item("CRITICAL", "DOES_NOT_MEET")] },
      [{ code: "OPERATIONAL_CAPACITY" }],
      40,
    );
    expect(result.score).toBe(0);
    expect(result.hasCriticalFailure).toBe(true);
    expect(result.dimensions[0]?.status).toBe("CALCULATED");
  });

  it("does not score a missing assessment as zero", () => {
    const result = calculateTechnicalCapacity(
      { matrixId: ids[3], matrixVersion: 1, matrixStatus: "IN_ANALYSIS", items: [item("HIGH")] },
      [{ code: "OPERATIONAL_CAPACITY" }],
      40,
    );
    expect(result.score).toBeUndefined();
    expect(result.dimensions[0]?.status).toBe("NOT_CALCULABLE");
    expect(result.dimensions[0]?.pendingItems.length).toBeGreaterThan(0);
  });
});
