import { randomUUID } from "node:crypto";
import { z } from "zod";

import { RouteApiUnavailableError, type RouteApi } from "../application/route-api";
import {
  routeBaseSchema,
  routeDestinationSchema,
  routeMatrixResponseSchema,
  type RouteBase,
  type RouteDestination,
} from "../domain/route-study";
import { AzureMapsClient, type AzureMapsConfiguration } from "./azure-maps-client";

const matrixResponseSchema = z.object({
  properties: z.object({
    matrix: z.array(z.object({
      originIndex: z.number().int().nonnegative(),
      destinationIndex: z.number().int().nonnegative(),
      statusCode: z.number().int(),
      distanceInMeters: z.number().int().nonnegative().optional(),
      durationInSeconds: z.number().nonnegative().optional(),
      durationTrafficInSeconds: z.number().nonnegative().optional(),
    })),
  }),
});

const coordinateSchema = z.tuple([z.number(), z.number()]);
const directionsResponseSchema = z.object({
  features: z.array(z.object({
    geometry: z.object({
      type: z.enum(["LineString", "MultiLineString"]),
      coordinates: z.union([
        z.array(coordinateSchema),
        z.array(z.array(coordinateSchema)),
      ]),
    }),
    properties: z.object({
      type: z.string(),
      distanceInMeters: z.number().int().nonnegative().optional(),
      durationInSeconds: z.number().nonnegative().optional(),
      durationTrafficInSeconds: z.number().nonnegative().optional(),
    }),
  })),
});

const waypointCollection = (coordinates: readonly [number, number][]) => ({
  type: "FeatureCollection",
  features: coordinates.map(([longitude, latitude], pointIndex) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [longitude, latitude] },
    properties: { pointIndex, pointType: "waypoint" },
  })),
  optimizeRoute: "fastestWithTraffic",
  travelMode: "driving",
});

export class AzureMapsRoutesApi implements RouteApi {
  private readonly client: AzureMapsClient;

  constructor(configuration?: AzureMapsConfiguration, fetcher: typeof fetch = fetch) {
    this.client = new AzureMapsClient(configuration, fetcher);
  }

  async computeMatrix(basesInput: RouteBase[], destinationInput: RouteDestination) {
    const bases = routeBaseSchema.array().min(1).max(25).parse(basesInput);
    const destination = routeDestinationSchema.parse(destinationInput);
    const url = new URL("https://atlas.microsoft.com/route/matrix");
    url.searchParams.set("api-version", "2025-01-01");
    try {
      const response = await this.client.request(url, {
        method: "POST",
        headers: { "content-type": "application/geo+json", "accept-language": "pt-BR" },
        body: JSON.stringify({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "MultiPoint",
                coordinates: bases.map(base => [base.longitude, base.latitude]),
              },
              properties: { pointType: "origins" },
            },
            {
              type: "Feature",
              geometry: {
                type: "MultiPoint",
                coordinates: [[destination.longitude, destination.latitude]],
              },
              properties: { pointType: "destinations" },
            },
          ],
          optimizeRoute: "fastestWithTraffic",
          traffic: "live",
          travelMode: "driving",
        }),
      });
      const raw = matrixResponseSchema.parse(await response.json());
      return routeMatrixResponseSchema.parse({
        provider: "Azure Maps",
        requestId: response.headers.get("x-ms-request-id") ?? randomUUID(),
        retrievedAt: new Date().toISOString(),
        routes: raw.properties.matrix.map(item => ({
          baseId: bases[item.originIndex]?.id,
          condition: item.statusCode === 200 ? "ROUTE_EXISTS" : "ROUTE_NOT_FOUND",
          distanceMeters: item.distanceInMeters,
          durationSeconds: item.durationTrafficInSeconds ?? item.durationInSeconds,
          tolls: [],
        })),
        sourceMetadata: {
          method: "route/matrix",
          apiVersion: "2025-01-01",
          optimizeRoute: "fastestWithTraffic",
          traffic: "live",
        },
      });
    } catch (error) {
      throw new RouteApiUnavailableError("Não foi possível consultar as rotas no Azure Maps.", { cause: error });
    }
  }

  async computeRoute(baseInput: RouteBase, destinationInput: RouteDestination) {
    const base = routeBaseSchema.parse(baseInput);
    const destination = routeDestinationSchema.parse(destinationInput);
    const url = new URL("https://atlas.microsoft.com/route/directions");
    url.searchParams.set("api-version", "2025-01-01");
    try {
      const response = await this.client.request(url, {
        method: "POST",
        headers: { "content-type": "application/geo+json", "accept-language": "pt-BR" },
        body: JSON.stringify({
          ...waypointCollection([
            [base.longitude, base.latitude],
            [destination.longitude, destination.latitude],
          ]),
          routeOutputOptions: ["routePath"],
        }),
      });
      const raw = directionsResponseSchema.parse(await response.json());
      const route = raw.features.find(feature => feature.properties.type === "RoutePath");
      if (!route || route.properties.distanceInMeters === undefined) {
        throw new RouteApiUnavailableError("O Azure Maps não retornou uma rota válida.");
      }
      return {
        provider: "Azure Maps",
        retrievedAt: new Date().toISOString(),
        baseId: base.id,
        distanceMeters: route.properties.distanceInMeters,
        durationSeconds: route.properties.durationTrafficInSeconds
          ?? route.properties.durationInSeconds
          ?? 0,
        encodedPolyline: JSON.stringify(route.geometry.coordinates),
        tolls: [],
      };
    } catch (error) {
      if (error instanceof RouteApiUnavailableError) throw error;
      throw new RouteApiUnavailableError("Não foi possível consultar a rota no Azure Maps.", { cause: error });
    }
  }
}
