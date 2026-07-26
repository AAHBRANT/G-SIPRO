import { describe, expect, it } from "vitest";

import { calculateClimateStudy } from "./climate-study";

const context = {
  locationLabel: "São Paulo/SP",
  latitude: -23.55052,
  longitude: -46.633308,
  workStart: "2026-01-15",
  workEnd: "2026-03-20",
};

const response = {
  provider: "API climática autorizada",
  requestId: "climate-001",
  retrievedAt: "2026-07-24T18:00:00.000Z",
  historyStart: "2000-01-01",
  historyEnd: "2025-12-31",
  monthly: [
    { month: 1, precipitationMm: 230, averageTemperatureC: 24, sampleYears: 26, completeness: 100 },
    { month: 2, precipitationMm: 190, averageTemperatureC: 24, sampleYears: 26, completeness: 100 },
    { month: 3, precipitationMm: 160, averageTemperatureC: 23, sampleYears: 26, completeness: 100 },
  ],
  sourceMetadata: { dataset: "historical-monthly" },
};

describe("climate study", () => {
  it("uses only API data for the project months", () => {
    const result = calculateClimateStudy(context, response, [{ code: "PRACTICABILITY" }], 25);
    expect(result.projectMonths).toEqual([1, 2, 3]);
    expect(result.expectedHistoricalPrecipitationMm).toBe(580);
    expect(result.responseHash).toHaveLength(64);
  });

  it("does not invent a practicability score without an approved productivity rule", () => {
    const result = calculateClimateStudy(context, response, [{ code: "PRACTICABILITY" }], 25);
    expect(result.dimensions[0]?.status).toBe("NOT_CALCULABLE");
    expect(result.dimensions[0]?.score).toBeUndefined();
    expect(result.dimensions[0]?.pendingItems.some(item => item.description.includes("produtividade"))).toBe(true);
  });

  it("reduces coverage when the API omits a project month", () => {
    const result = calculateClimateStudy(context, { ...response, monthly: response.monthly.slice(0, 2) }, [{ code: "PRACTICABILITY" }], 25);
    expect(result.dataCoverage).toBeCloseTo(66.6667, 4);
    expect(result.dimensions[0]?.risks.some(risk => risk.includes("mês(es)"))).toBe(true);
  });
});
