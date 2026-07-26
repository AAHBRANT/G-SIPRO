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
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(url.toString()).not.toContain("secret");
    expect((init.headers as Record<string, string>)["subscription-key"]).toBe("secret");
    expect(body).toMatchObject({
      departAt: "now",
      optimizeRoute: "fastest",
      traffic: "live",
      travelMode: "driving",
    });
    expect(result.routes[0]?.durationSeconds).toBe(28_800);
    expect(result.provider).toBe("Azure Maps");
  });

  it("calcula a rota mesmo quando a resposta mistura marcadores Point com a geometria da rota", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      type: "FeatureCollection",
      features: [
        { type: "Feature", geometry: { type: "Point", coordinates: [base.longitude, base.latitude] }, properties: { type: "Waypoint", pointIndex: 0 } },
        { type: "Feature", geometry: { type: "Point", coordinates: [destination.longitude, destination.latitude] }, properties: { type: "Waypoint", pointIndex: 1 } },
        {
          type: "Feature",
          geometry: { type: "LineString", coordinates: [[base.longitude, base.latitude], [destination.longitude, destination.latitude]] },
          properties: { type: "RoutePath", distanceInMeters: 586_400, durationInSeconds: 28_800 },
        },
      ],
    }), { status: 200 }));
    const result = await new AzureMapsRoutesApi(
      { subscriptionKey: "secret", timeoutMs: 5_000 },
      fetcher,
    ).computeRoute(base, destination);
    expect(result.distanceMeters).toBe(586_400);
    expect(JSON.parse(result.encodedPolyline)).toEqual([[base.longitude, base.latitude], [destination.longitude, destination.latitude]]);
  });
});
