import { z } from "zod";
import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { MatrixExportService } from "@/modules/compliance-matrices/application/matrix-export-service";
import { PrismaMatrixExportRepository } from "@/modules/compliance-matrices/infrastructure/prisma-matrix-export-repository";
import { mapMatrixExportApiError } from "@/modules/compliance-matrices/presentation/matrix-export-api";

export async function GET(request: Request, route: { params: Promise<{ id: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => { try { const authorization = await requirePermission("compliance-matrices.export"); const id = z.uuid().parse((await route.params).id); const data = await new MatrixExportService(new PrismaMatrixExportRepository()).download(id, authorization.actorId, context.correlationId); return new Response(data.content, { status: 200, headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${data.fileName}"`, "x-content-sha256": data.fileHash, "x-correlation-id": context.correlationId, "cache-control": "private, no-store" } }); } catch (error) { try { mapMatrixExportApiError(error); } catch (mapped) { return toApiError(mapped); } } });
}

