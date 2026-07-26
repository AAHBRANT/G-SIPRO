import { describe, expect, it, vi } from "vitest";

import { HttpClimateApi } from "./http-climate-api";

const context = {
  locationLabel: "São Paulo/SP",
  latitude: -23.55,
  longitude: -46.63,
  workStart: "2026-01-01",
  workEnd: "2026-12-31",
};

describe("HttpClimateApi", () => {
  it("requests monthly historical data without exposing the token in the URL", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      provider: "Provider",
      retrievedAt: "2026-07-24T18:00:00.000Z",
      historyStart: "2000-01-01",
      historyEnd: "2025-12-31",
      monthly: [{ month: 1, precipitationMm: 200, sampleYears: 26, completeness: 100 }],
      sourceMetadata: {},
    }), { status: 200 }));
    await new HttpClimateApi(
      { baseUrl: "https://clima.example/historical", token: "secret", timeoutMs: 5_000 },
      fetcher,
    ).collectHistoricalMonthly(context);

    const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit];
    expect(url.searchParams.get("history")).toBe("longest-reliable");
    expect(url.toString()).not.toContain("secret");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer secret");
  });
});
