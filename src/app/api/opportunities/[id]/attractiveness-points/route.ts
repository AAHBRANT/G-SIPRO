import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { AttractivenessService } from "@/modules/opportunity-intelligence/application/attractiveness-service";
import { PrismaAttractivenessRepository } from "@/modules/opportunity-intelligence/infrastructure/prisma-attractiveness-repository";

const service = () => new AttractivenessService(new PrismaAttractivenessRepository());

export async function GET(request: Request, route: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      await requirePermission("analytics.read");
      const opportunityId = z.uuid().parse((await route.params).id);
      const data = await service().list(opportunityId);
      return NextResponse.json({ data, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}

export async function POST(request: Request, route: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("analytics.calculate");
      const opportunityId = z.uuid().parse((await route.params).id);
      const data = await service().add(opportunityId, await request.json(), authorization.actorId);
      return NextResponse.json({ data, correlationId: context.correlationId }, { status: 201 });
    } catch (error) {
      return toApiError(error);
    }
  });
}
