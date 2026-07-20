import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { ItemAssessmentService } from "@/modules/compliance-matrices/application/item-assessment-service";
import { PrismaItemAssessmentRepository } from "@/modules/compliance-matrices/infrastructure/prisma-item-assessment-repository";
import { mapItemAssessmentApiError } from "@/modules/compliance-matrices/presentation/item-assessment-api";

export async function POST(request: Request, route: { params: Promise<{ id: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => { try { const authorization = await requirePermission("compliance-matrices.validate-item"); const id = z.uuid().parse((await route.params).id); const data = await new ItemAssessmentService(new PrismaItemAssessmentRepository()).validate(id, await request.json(), authorization.actorId, context.correlationId); return NextResponse.json({ data, correlationId: context.correlationId }, { status: 201 }); } catch (error) { try { mapItemAssessmentApiError(error); } catch (mapped) { return toApiError(mapped); } } });
}

