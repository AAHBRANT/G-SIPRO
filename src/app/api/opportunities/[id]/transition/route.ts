import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { OpportunityService } from "@/modules/opportunities/application/opportunity-service";
import { opportunityStatuses } from "@/modules/opportunities/domain/opportunity";
import { PrismaOpportunityRepository } from "@/modules/opportunities/infrastructure/prisma-opportunity-repository";
import { mapOpportunityApiError } from "@/modules/opportunities/presentation/opportunity-api";

const transitionSchema = z.object({
  target: z.enum(opportunityStatuses),
  closureReasonCode: z.string().trim().min(1).max(80).optional(),
  closureJustification: z.string().trim().min(1).max(1000).optional(),
  reason: z.string().trim().min(1).max(1000).optional(),
});

export async function POST(request: Request, route: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("opportunities.transition");
      const id = z.uuid().parse((await route.params).id);
      const input = transitionSchema.parse(await request.json());
      const service = new OpportunityService(new PrismaOpportunityRepository());
      const opportunity = await service.transition(
        id,
        input.target,
        authorization.actorId,
        input,
        context.correlationId,
      );
      return NextResponse.json({ data: opportunity, correlationId: context.correlationId });
    } catch (error) {
      try {
        mapOpportunityApiError(error);
      } catch (mapped) {
        return toApiError(mapped);
      }
    }
  });
}
