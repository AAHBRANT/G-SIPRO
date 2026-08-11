import { NextResponse } from "next/server";

import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { defaultScoutFilter, scoutFilterSchema } from "@/modules/scouting/domain/scout-filter";
import { PrismaScoutRepository } from "@/modules/scouting/infrastructure/prisma-scouting-repository";

export async function GET(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      await requirePermission("opportunities.read");
      const stored = await new PrismaScoutRepository().loadFilter();
      return NextResponse.json({ data: stored ?? defaultScoutFilter, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}

export async function PUT(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("opportunities.update");
      const filter = scoutFilterSchema.parse(await request.json());
      await new PrismaScoutRepository().saveFilter(filter, authorization.actorId);
      return NextResponse.json({ data: filter, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
