import { NextResponse } from "next/server";
import { z } from "zod";

import { requireOwner, requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { ResourceNotFoundError } from "@/core/errors/application-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import {
  OpportunityAnalysisDecisionService,
  opportunityAnalysisDecisionSchema,
} from "@/modules/opportunity-intelligence/application/opportunity-analysis-decision-service";
import { PrismaOpportunityAnalysisDecisionRepository } from "@/modules/opportunity-intelligence/infrastructure/prisma-opportunity-analysis-decision-repository";

export async function POST(request: Request, route: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("analytics.decide");
      const analysisId = z.uuid().parse((await route.params).id);
      const input = opportunityAnalysisDecisionSchema.parse(await request.json());
      const service = new OpportunityAnalysisDecisionService(new PrismaOpportunityAnalysisDecisionRepository());
      const current = await service.findContext(analysisId);
      if (!current) throw new ResourceNotFoundError("Análise de oportunidade não encontrada.");
      const isOverride = input.decision !== "DO_NOT_PROCEED"
        && (current.hasOpenImpediment || current.recommendation === "NOT_RECOMMENDED");
      if (isOverride) await requireOwner();
      const data = await service.decide(analysisId, input, authorization.actorId, context.correlationId);
      return NextResponse.json({ data, correlationId: context.correlationId }, { status: 201 });
    } catch (error) {
      return toApiError(error);
    }
  });
}
