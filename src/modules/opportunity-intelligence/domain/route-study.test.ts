import { describe, expect, it } from "vitest";

import { calculateRouteStudy } from "./route-study";

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

describe("route study", () => {
  it("converts provider distances and durations without selecting a base", () => {
    const result = calculateRouteStudy(destination, [base], {
      provider: "Google Routes",
      retrievedAt: "2026-07-24T19:00:00.000Z",
      routes: [{
        baseId: base.id,
        condition: "ROUTE_EXISTS",
        distanceMeters: 586_400,
        durationSeconds: 28_800,
        tolls: [{ currencyCode: "BRL", units: "120", nanos: 0 }],
      }],
      sourceMetadata: {},
    });
    expect(result.alternatives[0]).toMatchObject({ distanceKm: 586.4, durationHours: 8 });
    expect(result.selectionStatus).toBe("PENDING_RULE");
  });

  it("does not convert a missing route into zero", () => {
    const result = calculateRouteStudy(destination, [base], {
      provider: "Google Routes",
      retrievedAt: "2026-07-24T19:00:00.000Z",
      routes: [{ baseId: base.id, condition: "ROUTE_NOT_FOUND", tolls: [] }],
      sourceMetadata: {},
    });
    expect(result.alternatives[0]?.distanceMeters).toBeUndefined();
    expect(result.pendingItems.some(item => item.description.includes("não possuem rota"))).toBe(true);
  });

  it("records the base explicitly selected by the user", () => {
    const result = calculateRouteStudy(destination, [base], {
      provider: "Azure Maps",
      retrievedAt: "2026-07-24T19:00:00.000Z",
      routes: [{
        baseId: base.id,
        condition: "ROUTE_EXISTS",
        distanceMeters: 586_400,
        durationSeconds: 28_800,
        tolls: [],
      }],
      sourceMetadata: {},
    }, base.id);

    expect(result.selectedBaseId).toBe(base.id);
    expect(result.selectionStatus).toBe("USER_SELECTED");
    expect(result.pendingItems.some(item => item.description.includes("seleção da base"))).toBe(false);
  });
});
