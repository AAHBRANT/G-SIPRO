import { NextResponse } from "next/server";
import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { IntelligencePolicyService } from "@/modules/opportunity-intelligence/application/intelligence-policy-service";
import { PrismaIntelligencePolicyRepository } from "@/modules/opportunity-intelligence/infrastructure/prisma-intelligence-policy-repository";
import { mapIntelligencePolicyApiError } from "@/modules/opportunity-intelligence/presentation/intelligence-policy-api";

export async function POST(request: Request) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("analytics.configure");
      const data = await new IntelligencePolicyService(new PrismaIntelligencePolicyRepository())
        .addPolicy(await request.json(), authorization.actorId, context.correlationId);
      return NextResponse.json({ data, correlationId: context.correlationId }, { status: 201 });
    } catch (error) {
      try { mapIntelligencePolicyApiError(error); } catch (mapped) { return toApiError(mapped); }
    }
  });
}
