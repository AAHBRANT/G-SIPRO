import { describe, expect, it } from "vitest";

import { calculateCommercialPreliminaryAnalysis } from "./commercial-preliminary-analysis";

const opportunity = {
  id: "00000000-0000-4000-8000-000000000001",
  version: 2,
  code: "OPP-001",
  origin: "Diário oficial",
  subject: "Execução de obra pública",
  contractingAuthorityId: "00000000-0000-4000-8000-000000000002",
  estimatedValue: 10_000_000,
  currency: "BRL",
  valueSource: "Edital",
  deliveryAt: new Date("2026-08-30T12:00:00.000Z"),
  datesSource: "Edital",
  datesTimeZone: "America/Sao_Paulo",
  ownerId: "00000000-0000-4000-8000-000000000003",
};

const policy = {
  id: "00000000-0000-4000-8000-000000000004",
  version: 1,
  dimensions: [
    { perspective: "COMMERCIAL" as const, code: "ATTRACTIVENESS", name: "Atratividade", critical: false },
    { perspective: "TECHNICAL" as const, code: "OPERATIONAL_CAPACITY", name: "Capacidade operacional", critical: true },
    { perspective: "STUDIES" as const, code: "PRACTICABILITY", name: "Praticabilidade", critical: false },
  ],
  weights: { commercial: 35, technical: 40, studies: 25 },
  thresholds: { recommendedMinimum: 80, restrictionsMinimum: 60, minimumConfidence: 70 },
  coverageMinimum: 70,
};

describe("commercial preliminary analysis", () => {
  it("calculates a deterministic partial commercial result", () => {
    const first = calculateCommercialPreliminaryAnalysis(opportunity, policy);
    const second = calculateCommercialPreliminaryAnalysis(opportunity, policy);

    expect(first).toEqual(second);
    expect(first.score).toBe(100);
    expect(first.coverage).toBe(35);
    expect(first.recommendation).toBe("WAITING_INFORMATION");
    expect(first.status).toBe("PARTIAL");
    expect(first.dimensions[0]?.resultHash).toHaveLength(64);
  });

  it("does not turn missing commercial data into a zero score", () => {
    const result = calculateCommercialPreliminaryAnalysis({
      id: opportunity.id,
      version: 1,
      code: opportunity.code,
      origin: opportunity.origin,
    }, policy);

    expect(result.score).toBeUndefined();
    expect(result.coverage).toBe(0);
    expect(result.status).toBe("WAITING_INFORMATION");
    expect(result.dimensions[0]?.status).toBe("NOT_CALCULABLE");
    expect(result.dimensions[0]?.pendingItems.length).toBeGreaterThan(0);
  });

  it("changes the input hash when a material opportunity value changes", () => {
    const original = calculateCommercialPreliminaryAnalysis(opportunity, policy);
    const revised = calculateCommercialPreliminaryAnalysis({ ...opportunity, estimatedValue: 12_000_000 }, policy);
    expect(revised.inputHash).not.toBe(original.inputHash);
  });
});
