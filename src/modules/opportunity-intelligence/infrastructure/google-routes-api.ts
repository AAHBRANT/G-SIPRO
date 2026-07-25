import { randomUUID } from "node:crypto";
import { z } from "zod";

import { ConfigurationError } from "@/core/errors/application-error";
import { RouteApiUnavailableError, type RouteApi } from "../application/route-api";
import {
  routeBaseSchema,
  routeDestinationSchema,
  routeMatrixResponseSchema,
  type RouteBase,
  type RouteDestination,
} from "../domain/route-study";

const money = z.object({
  currencyCode: z.string().length(3),
  units: z.string().default("0"),
  nanos: z.number().int().default(0),
});
const rawMatrixSchema = z.array(z.object({
  originIndex: z.number().int().nonnegative(),
  destinationIndex: z.number().int().nonnegative(),
  condition: z.enum(["ROUTE_EXISTS", "ROUTE_NOT_FOUND"]),
  distanceMeters: z.number().int().nonnegative().optional(),
  duration: z.string().optional(),
  travelAdvisory: z.object({
    tollInfo: z.object({ estimatedPrice: z.array(money).default([]) }).optional(),
  }).optional(),
}));
const rawRouteSchema = z.object({
  routes: z.array(z.object({
    distanceMeters: z.number().int().nonnegative(),
    duration: z.string(),
    polyline: z.object({ encodedPolyline: z.string().min(1) }),
    travelAdvisory: z.object({
      tollInfo: z.object({ estimatedPrice: z.array(money).default([]) }).optional(),
    }).optional(),
  })).min(1),
});

type Configuration = Readonly<{ apiKey: string; timeoutMs: number }>;

function configurationFromEnvironment(): Configuration {
  const apiKey = process.env.GOOGLE_ROUTES_API_KEY?.trim();
  if (!apiKey) {
    throw new ConfigurationError(
      "A Google Routes API ainda não foi configurada.",
      { missing: "GOOGLE_ROUTES_API_KEY" },
    );
  }
  const timeout = Number(process.env.GOOGLE_ROUTES_TIMEOUT_MS) || 30_000;
  return { apiKey, timeoutMs: Math.min(Math.max(timeout, 5_000), 120_000) };
}

const durationSeconds = (value: string) => {
  const match = /^(\d+(?:\.\d+)?)s$/.exec(value);
  if (!match) throw new RouteApiUnavailableError("A API retornou uma duração inválida.");
  return Number(match[1]);
};
const waypoint = (latitude: number, longitude: number) => ({
  waypoint: { location: { latLng: { latitude, longitude } } },
});

export class GoogleRoutesApi implements RouteApi {
  constructor(
    private readonly configuration: Configuration = configurationFromEnvironment(),
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async computeMatrix(basesInput: RouteBase[], destinationInput: RouteDestination) {
    const bases = routeBaseSchema.array().min(1).max(25).parse(basesInput);
    const destination = routeDestinationSchema.parse(destinationInput);
    const payload = {
      origins: bases.map(base => waypoint(base.latitude, base.longitude)),
      destinations: [waypoint(destination.latitude, destination.longitude)],
      travelMode: destination.travelMode,
      routingPreference: "TRAFFIC_AWARE",
      extraComputations: ["TOLLS"],
    };
    const raw = rawMatrixSchema.parse(await this.request(
      "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
      payload,
      "originIndex,destinationIndex,condition,distanceMeters,duration,travelAdvisory.tollInfo",
    ));
    return routeMatrixResponseSchema.parse({
      provider: "Google Routes API",
      requestId: randomUUID(),
      retrievedAt: new Date().toISOString(),
      routes: raw.map(item => ({
        baseId: bases[item.originIndex]?.id,
        condition: item.condition,
        distanceMeters: item.distanceMeters,
        durationSeconds: item.duration ? durationSeconds(item.duration) : undefined,
        tolls: item.travelAdvisory?.tollInfo?.estimatedPrice ?? [],
      })),
      sourceMetadata: {
        method: "computeRouteMatrix",
        fieldMask: "originIndex,destinationIndex,condition,distanceMeters,duration,travelAdvisory.tollInfo",
        routingPreference: "TRAFFIC_AWARE",
      },
    });
  }

  async computeRoute(baseInput: RouteBase, destinationInput: RouteDestination) {
    const base = routeBaseSchema.parse(baseInput);
    const destination = routeDestinationSchema.parse(destinationInput);
    const raw = rawRouteSchema.parse(await this.request(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        origin: waypoint(base.latitude, base.longitude).waypoint,
        destination: waypoint(destination.latitude, destination.longitude).waypoint,
        travelMode: destination.travelMode,
        routingPreference: "TRAFFIC_AWARE",
        extraComputations: ["TOLLS"],
        polylineQuality: "OVERVIEW",
      },
      "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.travelAdvisory.tollInfo",
    ));
    const route = raw.routes[0]!;
    return {
      provider: "Google Routes API",
      retrievedAt: new Date().toISOString(),
      baseId: base.id,
      distanceMeters: route.distanceMeters,
      durationSeconds: durationSeconds(route.duration),
      encodedPolyline: route.polyline.encodedPolyline,
      tolls: route.travelAdvisory?.tollInfo?.estimatedPrice ?? [],
    };
  }

  private async request(url: string, payload: object, fieldMask: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.configuration.timeoutMs);
    try {
      const response = await this.fetcher(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": this.configuration.apiKey,
          "x-goog-fieldmask": fieldMask,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        throw new RouteApiUnavailableError(`A Google Routes API respondeu com status ${response.status}.`);
      }
      return await response.json();
    } catch (error) {
      if (error instanceof RouteApiUnavailableError) throw error;
      throw new RouteApiUnavailableError("Não foi possível consultar a Google Routes API.", { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }
}
