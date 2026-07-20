import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { MatrixExportService } from "@/modules/compliance-matrices/application/matrix-export-service";
import { PrismaMatrixExportRepository } from "@/modules/compliance-matrices/infrastructure/prisma-matrix-export-repository";
import { mapMatrixExportApiError } from "@/modules/compliance-matrices/presentation/matrix-export-api";

export async function POST(request: Request, route: { params: Promise<{ id: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => { try { const authorization = await requirePermission("compliance-matrices.finalize"); const id = z.uuid().parse((await route.params).id); const data = await new MatrixExportService(new PrismaMatrixExportRepository()).finalize(id, authorization.actorId, context.correlationId); return NextResponse.json({ data: { ...data, downloadUrl: `/api/compliance-matrices/exports/${data.id}` }, correlationId: context.correlationId }, { status: 201 }); } catch (error) { try { mapMatrixExportApiError(error); } catch (mapped) { return toApiError(mapped); } } });
}

