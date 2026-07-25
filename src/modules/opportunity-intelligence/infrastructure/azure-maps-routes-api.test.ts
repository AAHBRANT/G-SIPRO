import { describe, expect, it, vi } from "vitest";

import { AzureMapsRoutesApi } from "./azure-maps-routes-api";

const base = {
  id: "00000000-0000-4000-8000-000000000001",
  code: "SEDE",
  name: "Sede",
  locality: "Belo Horizonte/MG",
  latitude: -19.92,
  longitude: -43.94,
  version: 1,
};
const destination = { label: "São Paulo/SP", latitude: -23.55, longitude: -46.63, travelMode: "DRIVE" as const };

describe("AzureMapsRoutesApi", () => {
  it("calcula a matriz com a chave protegida no cabeçalho", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      type: "Feature",
      geometry: null,
      properties: {
        matrix: [{
          originIndex: 0,
          destinationIndex: 0,
          statusCode: 200,
          distanceInMeters: 586_400,
          durationInSeconds: 28_800,
        }],
      },
    }), { status: 200 }));
    const result = await new AzureMapsRoutesApi(
      { subscriptionKey: "secret", timeoutMs: 5_000 },
      fetcher,
    ).computeMatrix([base], destination);
    const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).not.toContain("secret");
    expect((init.headers as Record<string, string>)["subscription-key"]).toBe("secret");
    expect(result.routes[0]?.durationSeconds).toBe(28_800);
    expect(result.provider).toBe("Azure Maps");
  });
});
