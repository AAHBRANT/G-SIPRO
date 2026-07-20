import { NextResponse } from "next/server";

import { getEnvironment } from "@/core/config/env";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const suppliedCorrelationId = request.headers.get("x-correlation-id") ?? undefined;
  const context = createRequestContext({ correlationId: suppliedCorrelationId });

  return runWithRequestContext(context, () => {
    const environment = getEnvironment();
    return NextResponse.json(
      {
        status: "ok",
        service: environment.APP_NAME,
        version: environment.APP_VERSION,
        timestamp: new Date().toISOString(),
        correlationId: context.correlationId,
      },
      { headers: { "x-correlation-id": context.correlationId } },
    );
  });
}
