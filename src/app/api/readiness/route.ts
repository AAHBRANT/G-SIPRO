import { NextResponse } from "next/server";

import { getEnvironment } from "@/core/config/env";
import { getDatabase } from "@/core/database/prisma";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const context = createRequestContext({
    correlationId: request.headers.get("x-correlation-id") ?? undefined,
  });

  return runWithRequestContext(context, async () => {
    const environment = getEnvironment();

    try {
      await getDatabase().$queryRaw`SELECT 1`;
      return NextResponse.json(
        {
          status: "ready",
          service: environment.APP_NAME,
          version: environment.APP_VERSION,
          dependencies: { database: "available" },
          timestamp: new Date().toISOString(),
          correlationId: context.correlationId,
        },
        { headers: { "x-correlation-id": context.correlationId } },
      );
    } catch {
      return NextResponse.json(
        {
          status: "unavailable",
          service: environment.APP_NAME,
          dependencies: { database: "unavailable" },
          correlationId: context.correlationId,
        },
        {
          status: 503,
          headers: { "x-correlation-id": context.correlationId },
        },
      );
    }
  });
}
