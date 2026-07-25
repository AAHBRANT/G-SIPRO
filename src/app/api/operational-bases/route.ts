import { NextResponse } from "next/server";

import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import {
  OperationalBaseRegistrationService,
  OperationalBaseService,
} from "@/modules/opportunity-intelligence/application/operational-base-service";
import { AzureMapsGeocodingApi } from "@/modules/opportunity-intelligence/infrastructure/azure-maps-geocoding-api";
import { PrismaOperationalBaseRepository } from "@/modules/opportunity-intelligence/infrastructure/prisma-operational-base-repository";

export async function GET(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      await requirePermission("analytics.read");
      const data = await new OperationalBaseService(new PrismaOperationalBaseRepository()).listActive();
      return NextResponse.json({ data, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("analytics.configure");
      const data = await new OperationalBaseRegistrationService(
        new PrismaOperationalBaseRepository(),
        new AzureMapsGeocodingApi(),
      ).createFromAddress(await request.json(), authorization.actorId, context.correlationId);
      return NextResponse.json({ data, correlationId: context.correlationId }, { status: 201 });
    } catch (error) {
      return toApiError(error);
    }
  });
}
