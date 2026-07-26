import type { RouteBase, RouteDestination, RouteMatrixResponse } from "../domain/route-study";

export type RouteDetail = Readonly<{
  provider: string;
  retrievedAt: string;
  baseId: string;
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
  tolls: readonly { currencyCode: string; units: string; nanos: number }[];
}>;

export interface RouteApi {
  computeMatrix(bases: RouteBase[], destination: RouteDestination): Promise<RouteMatrixResponse>;
  computeRoute(base: RouteBase, destination: RouteDestination): Promise<RouteDetail>;
}

export class RouteApiUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RouteApiUnavailableError";
  }
}
