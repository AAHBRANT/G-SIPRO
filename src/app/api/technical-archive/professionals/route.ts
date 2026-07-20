import { NextResponse } from "next/server";
import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { ProfessionalService } from "@/modules/technical-archive/application/professional-service";
import { PrismaProfessionalRepository } from "@/modules/technical-archive/infrastructure/prisma-professional-repository";
import { mapProfessionalApiError } from "@/modules/technical-archive/presentation/professional-api";

export async function GET(request: Request) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("technical-professionals.read");
      const data = await new ProfessionalService(new PrismaProfessionalRepository()).list(authorization.actorId, context.correlationId);
      return NextResponse.json({ data, correlationId: context.correlationId });
    } catch (error) { return toApiError(error); }
  });
}

export async function POST(request: Request) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("technical-professionals.create");
      const data = await new ProfessionalService(new PrismaProfessionalRepository()).create(await request.json(), authorization.actorId, context.correlationId);
      return NextResponse.json({ data, correlationId: context.correlationId }, { status: 201 });
    } catch (error) {
      try { mapProfessionalApiError(error); } catch (mapped) { return toApiError(mapped); }
    }
  });
}
