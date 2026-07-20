import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { RequirementService } from "@/modules/requirements/application/requirement-service";
import { PrismaRequirementRepository } from "@/modules/requirements/infrastructure/prisma-requirement-repository";
import { mapRequirementApiError } from "@/modules/requirements/presentation/requirement-api";

export async function POST(request: Request, route: { params: Promise<{ id: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("requirements.validate");
      const id = z.uuid().parse((await route.params).id);
      const data = await new RequirementService(new PrismaRequirementRepository()).validate(id, await request.json(), authorization.actorId, context.correlationId);
      return NextResponse.json({ data, correlationId: context.correlationId });
    } catch (error) { try { mapRequirementApiError(error); } catch (mapped) { return toApiError(mapped); } }
  });
}
