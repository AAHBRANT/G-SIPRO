import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { MatrixEvidenceService } from "@/modules/compliance-matrices/application/matrix-evidence-service";
import { PrismaMatrixEvidenceRepository } from "@/modules/compliance-matrices/infrastructure/prisma-matrix-evidence-repository";
import { mapMatrixEvidenceApiError } from "@/modules/compliance-matrices/presentation/matrix-evidence-api";

export async function POST(request: Request, route: { params: Promise<{ id: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => { try { const authorization = await requirePermission("compliance-matrices.associate-evidence"); const id = z.uuid().parse((await route.params).id); const data = await new MatrixEvidenceService(new PrismaMatrixEvidenceRepository()).associate(id, await request.json(), authorization.actorId, context.correlationId); return NextResponse.json({ data, correlationId: context.correlationId }, { status: 201 }); } catch (error) { try { mapMatrixEvidenceApiError(error); } catch (mapped) { return toApiError(mapped); } } });
}
