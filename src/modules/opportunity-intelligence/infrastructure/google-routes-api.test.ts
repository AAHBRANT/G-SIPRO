import { describe, expect, it, vi } from "vitest";

import { GoogleRoutesApi } from "./google-routes-api";

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

describe("GoogleRoutesApi", () => {
  it("uses a restricted field mask and keeps the key out of the URL", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      originIndex: 0,
      destinationIndex: 0,
      condition: "ROUTE_EXISTS",
      distanceMeters: 586_400,
      duration: "28800s",
    }]), { status: 200 }));
    const result = await new GoogleRoutesApi({ apiKey: "secret", timeoutMs: 5_000 }, fetcher)
      .computeMatrix([base], destination);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("secret");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("secret");
    expect((init.headers as Record<string, string>)["x-goog-fieldmask"]).not.toBe("*");
    expect(result.routes[0]?.durationSeconds).toBe(28_800);
  });
});
