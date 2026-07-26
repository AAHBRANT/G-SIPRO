import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { AzureMapsClient } from "@/modules/opportunity-intelligence/infrastructure/azure-maps-client";
import { AzureMapsRoutesApi } from "@/modules/opportunity-intelligence/infrastructure/azure-maps-routes-api";

const querySchema = z.object({
  originLat: z.coerce.number().min(-90).max(90),
  originLng: z.coerce.number().min(-180).max(180),
  destinationLat: z.coerce.number().min(-90).max(90),
  destinationLng: z.coerce.number().min(-180).max(180),
});

type Position = [number, number];

function flattenPositions(value: unknown): Position[] {
  if (!Array.isArray(value)) return [];
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    return [[value[0], value[1]]];
  }
  return value.flatMap(flattenPositions);
}

function samplePositions(positions: Position[], limit = 100): Position[] {
  if (positions.length <= limit) return positions;
  const sampled = Array.from({ length: limit }, (_, index) => (
    positions[Math.round(index * (positions.length - 1) / (limit - 1))]!
  ));
  return sampled;
}

export async function GET(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      await requirePermission("analytics.read");
      const url = new URL(request.url);
      const query = querySchema.parse(Object.fromEntries(url.searchParams));
      const detail = await new AzureMapsRoutesApi().computeRoute({
        id: "00000000-0000-4000-8000-000000000001",
        code: "ORIGEM",
        name: "Origem",
        locality: "Base operacional",
        latitude: query.originLat,
        longitude: query.originLng,
        version: 1,
      }, {
        label: "Local da obra",
        latitude: query.destinationLat,
        longitude: query.destinationLng,
        travelMode: "DRIVE",
      });
      const positions = samplePositions(flattenPositions(JSON.parse(detail.encodedPolyline)));
      if (positions.length < 2) throw new Error("A rota não possui geometria suficiente para exibição.");

      const longitudes = positions.map(position => position[0]);
      const latitudes = positions.map(position => position[1]);
      const padding = 0.03;
      const mapUrl = new URL("https://atlas.microsoft.com/map/static");
      mapUrl.searchParams.set("api-version", "2024-04-01");
      mapUrl.searchParams.set("tilesetId", "microsoft.base.road");
      mapUrl.searchParams.set("language", "pt-BR");
      mapUrl.searchParams.set("bbox", [
        Math.min(...longitudes) - padding,
        Math.min(...latitudes) - padding,
        Math.max(...longitudes) + padding,
        Math.max(...latitudes) + padding,
      ].join(","));
      mapUrl.searchParams.set(
        "path",
        `lcB91C1C|lw4||${positions.map(([longitude, latitude]) => `${longitude} ${latitude}`).join("|")}`,
      );
      const map = await new AzureMapsClient().request(mapUrl, { headers: { accept: "image/png" } });
      return new NextResponse(await map.arrayBuffer(), {
        headers: {
          "content-type": map.headers.get("content-type") ?? "image/png",
          "cache-control": "private, max-age=3600",
          "x-correlation-id": context.correlationId,
        },
      });
    } catch (error) {
      return toApiError(error);
    }
  });
}
