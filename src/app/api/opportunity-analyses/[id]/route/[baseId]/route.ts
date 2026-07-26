import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { RouteStudyService } from "@/modules/opportunity-intelligence/application/route-study-service";
import { AzureMapsRoutesApi } from "@/modules/opportunity-intelligence/infrastructure/azure-maps-routes-api";
import { PrismaRouteStudyRepository } from "@/modules/opportunity-intelligence/infrastructure/prisma-route-study-repository";
import { mapOpportunityAnalysisApiError } from "@/modules/opportunity-intelligence/presentation/opportunity-analysis-api";

export async function POST(
  request: Request,
  route: { params: Promise<{ id: string; baseId: string }> },
): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("analytics.calculate");
      const params = await route.params;
      const analysisId = z.uuid().parse(params.id);
      const baseId = z.uuid().parse(params.baseId);
      const data = await new RouteStudyService(
        new PrismaRouteStudyRepository(),
        new AzureMapsRoutesApi(),
      ).loadMapRoute(analysisId, baseId, authorization.actorId, context.correlationId);
      return NextResponse.json({ data, correlationId: context.correlationId }, { status: 201 });
    } catch (error) {
      try {
        mapOpportunityAnalysisApiError(error);
      } catch (mapped) {
        return toApiError(mapped);
      }
    }
  });
}
