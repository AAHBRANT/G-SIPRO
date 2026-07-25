import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { ResourceNotFoundError } from "@/core/errors/application-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { RouteStudyService } from "@/modules/opportunity-intelligence/application/route-study-service";
import { PrismaRouteStudyRepository } from "@/modules/opportunity-intelligence/infrastructure/prisma-route-study-repository";

export async function GET(request: Request, route: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      await requirePermission("analytics.read");
      const analysisId = z.uuid().parse((await route.params).id);
      const data = await new RouteStudyService(new PrismaRouteStudyRepository()).find(analysisId);
      if (!data) throw new ResourceNotFoundError("Esta análise ainda não possui estudo logístico.");
      return NextResponse.json({ data, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
