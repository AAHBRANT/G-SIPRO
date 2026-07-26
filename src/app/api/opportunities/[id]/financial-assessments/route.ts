import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { FinancialAssessmentService } from "@/modules/opportunity-intelligence/application/financial-assessment-service";
import { PrismaFinancialAssessmentRepository } from "@/modules/opportunity-intelligence/infrastructure/prisma-financial-assessment-repository";

const service = () => new FinancialAssessmentService(new PrismaFinancialAssessmentRepository());

export async function GET(request: Request, route: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      await requirePermission("analytics.read-financial");
      const opportunityId = z.uuid().parse((await route.params).id);
      const data = await service().listFinancial(opportunityId);
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
      const authorization = await requirePermission("analytics.assess-financial");
      const opportunityId = z.uuid().parse((await route.params).id);
      const data = await service().createFinancial(
        opportunityId,
        await request.json(),
        authorization.actorId,
        context.correlationId,
      );
      return NextResponse.json({ data, correlationId: context.correlationId }, { status: 201 });
    } catch (error) {
      return toApiError(error);
    }
  });
}
