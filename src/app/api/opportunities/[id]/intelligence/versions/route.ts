import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { OpportunityAnalysisService } from "@/modules/opportunity-intelligence/application/opportunity-analysis-service";
import { PrismaOpportunityAnalysisRepository } from "@/modules/opportunity-intelligence/infrastructure/prisma-opportunity-analysis-repository";

export async function GET(request: Request, route: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      await requirePermission("analytics.read");
      const opportunityId = z.uuid().parse((await route.params).id);
      const data = await new OpportunityAnalysisService(new PrismaOpportunityAnalysisRepository())
        .listVersions(opportunityId);
      return NextResponse.json({ data, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
