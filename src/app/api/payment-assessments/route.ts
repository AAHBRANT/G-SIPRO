import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { ValidationError } from "@/core/errors/application-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { FinancialAssessmentService } from "@/modules/opportunity-intelligence/application/financial-assessment-service";
import { PrismaFinancialAssessmentRepository } from "@/modules/opportunity-intelligence/infrastructure/prisma-financial-assessment-repository";

const service = () => new FinancialAssessmentService(new PrismaFinancialAssessmentRepository());

export async function GET(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      await requirePermission("analytics.read-client-risk");
      const url = new URL(request.url);
      const customerId = url.searchParams.get("customerId");
      const authorityId = url.searchParams.get("authorityId");
      if ((customerId ? 1 : 0) + (authorityId ? 1 : 0) !== 1) {
        throw new ValidationError("Informe exatamente customerId ou authorityId.");
      }
      const data = await service().listPayment({
        ...(customerId && { customerId: z.uuid().parse(customerId) }),
        ...(authorityId && { authorityId: z.uuid().parse(authorityId) }),
      });
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
      const authorization = await requirePermission("analytics.assess-client-risk");
      const data = await service().createPayment(
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
