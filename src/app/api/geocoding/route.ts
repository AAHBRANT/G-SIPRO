import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { GoogleGeocodingApi } from "@/modules/opportunity-intelligence/infrastructure/google-geocoding-api";

const querySchema = z.object({ address: z.string().trim().min(2).max(500) });

export async function GET(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      await requirePermission("analytics.calculate");
      const url = new URL(request.url);
      const query = querySchema.parse({ address: url.searchParams.get("address") });
      const data = await new GoogleGeocodingApi().locate(query.address);
      return NextResponse.json({ data, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
