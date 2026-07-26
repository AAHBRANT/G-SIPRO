import { describe, expect, it, vi } from "vitest";

import {
  OpportunityAnalysisService,
  type OpportunityAnalysisRepository,
} from "./opportunity-analysis-service";

const repository = () => ({
  runCommercialPreliminary: vi.fn(),
  runTechnicalCapacity: vi.fn(),
  findLatest: vi.fn(),
  listVersions: vi.fn(),
}) satisfies OpportunityAnalysisRepository;

describe("OpportunityAnalysisService", () => {
  it("delegates the commercial preliminary run with trace context", async () => {
    const target = repository();
    const service = new OpportunityAnalysisService(target);
    await service.runCommercialPreliminary(
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
    );
    expect(target.runCommercialPreliminary).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
    );
  });

  it("delegates latest and version history queries", async () => {
    const target = repository();
    const service = new OpportunityAnalysisService(target);
    await service.findLatest("00000000-0000-4000-8000-000000000001");
    await service.listVersions("00000000-0000-4000-8000-000000000001");
    expect(target.findLatest).toHaveBeenCalledOnce();
    expect(target.listVersions).toHaveBeenCalledOnce();
  });

  it("delegates the technical-capacity run", async () => {
    const target = repository();
    await new OpportunityAnalysisService(target).runTechnicalCapacity(
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
    );
    expect(target.runTechnicalCapacity).toHaveBeenCalledOnce();
  });
});
