import { describe, expect, it, vi } from "vitest";

import { ClimateStudyService, type ClimateStudyRepository } from "./climate-study-service";
import type { ClimateApi } from "./climate-api";

describe("ClimateStudyService", () => {
  it("collects climate data from the API before recording the study", async () => {
    const response = {
      provider: "Provider",
      retrievedAt: "2026-07-24T18:00:00.000Z",
      historyStart: "2000-01-01",
      historyEnd: "2025-12-31",
      monthly: [{ month: 1, precipitationMm: 200, sampleYears: 26, completeness: 100 }],
      sourceMetadata: {},
    };
    const climateApi = {
      collectHistoricalMonthly: vi.fn().mockResolvedValue(response),
    } satisfies ClimateApi;
    const repository = {
      recordClimateStudy: vi.fn(),
      findClimateStudy: vi.fn(),
    } satisfies ClimateStudyRepository;
    const context = {
      locationLabel: "São Paulo/SP",
      latitude: -23.55,
      longitude: -46.63,
      workStart: "2026-01-01",
      workEnd: "2026-01-31",
    };

    await new ClimateStudyService(repository, climateApi).run(
      "00000000-0000-4000-8000-000000000001",
      context,
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
    );
    expect(climateApi.collectHistoricalMonthly).toHaveBeenCalledWith(context);
    expect(repository.recordClimateStudy).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      context,
      response,
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
    );
  });
});
