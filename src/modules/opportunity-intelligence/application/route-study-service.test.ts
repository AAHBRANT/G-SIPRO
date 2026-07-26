import { describe, expect, it, vi } from "vitest";

import { RouteStudyService, RouteStudyRuleError, type RouteStudyRepository } from "./route-study-service";
import type { RouteApi } from "./route-api";

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

const repository = (bases = [base]) => ({
  listActiveRouteBases: vi.fn().mockResolvedValue(bases),
  recordRouteStudy: vi.fn(),
  findRouteStudy: vi.fn(),
  findRouteDetailContext: vi.fn(),
  recordRouteDetail: vi.fn(),
}) satisfies RouteStudyRepository;

describe("RouteStudyService", () => {
  it("loads active bases before consulting the route API", async () => {
    const target = repository();
    const routeApi = {
      computeMatrix: vi.fn().mockResolvedValue({
        provider: "Google Routes API",
        retrievedAt: "2026-07-24T20:00:00.000Z",
        routes: [{ baseId: base.id, condition: "ROUTE_EXISTS", distanceMeters: 10, durationSeconds: 10, tolls: [] }],
        sourceMetadata: {},
      }),
      computeRoute: vi.fn(),
    } satisfies RouteApi;
    await new RouteStudyService(target, routeApi).run(
      "00000000-0000-4000-8000-000000000002",
      destination,
      base.id,
      "00000000-0000-4000-8000-000000000003",
    );
    expect(routeApi.computeMatrix).toHaveBeenCalledWith([base], destination);
    expect(target.recordRouteStudy).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000002",
      destination,
      [base],
      expect.any(Object),
      base.id,
      "00000000-0000-4000-8000-000000000003",
      expect.any(String),
    );
  });

  it("requires at least one active operational base", async () => {
    const target = repository([]);
    const routeApi = { computeMatrix: vi.fn(), computeRoute: vi.fn() } satisfies RouteApi;
    await expect(new RouteStudyService(target, routeApi).run(
      "00000000-0000-4000-8000-000000000002",
      destination,
      base.id,
      "00000000-0000-4000-8000-000000000003",
    )).rejects.toBeInstanceOf(RouteStudyRuleError);
  });

  it("rejects a departure base that is not active", async () => {
    const target = repository();
    const routeApi = { computeMatrix: vi.fn(), computeRoute: vi.fn() } satisfies RouteApi;
    await expect(new RouteStudyService(target, routeApi).run(
      "00000000-0000-4000-8000-000000000002",
      destination,
      "00000000-0000-4000-8000-000000000099",
      "00000000-0000-4000-8000-000000000003",
    )).rejects.toThrow("Selecione uma base operacional ativa");
    expect(routeApi.computeMatrix).not.toHaveBeenCalled();
  });
});
