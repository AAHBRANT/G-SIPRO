import { NextResponse } from "next/server";
import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { TechnicalSectionService } from "@/modules/proposal-sections/application/technical-section-service";
import { PrismaTechnicalSectionRepository } from "@/modules/proposal-sections/infrastructure/prisma-technical-section-repository";
import { mapTechnicalSectionApiError } from "@/modules/proposal-sections/presentation/technical-section-api";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; sectionId: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => { try { const authorization = await requirePermission("proposals.technical-sections.manage"); const { id, sectionId } = await params; const data = await new TechnicalSectionService(new PrismaTechnicalSectionRepository()).update(id, sectionId, await request.json(), authorization.actorId, context.correlationId); return NextResponse.json({ data, correlationId: context.correlationId }); } catch (error) { try { mapTechnicalSectionApiError(error); } catch (mapped) { return toApiError(mapped); } } });
}
