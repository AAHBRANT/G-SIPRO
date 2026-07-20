import { NextResponse } from "next/server";
import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { ComplianceMatrixService } from "@/modules/compliance-matrices/application/matrix-service";
import { PrismaComplianceMatrixRepository } from "@/modules/compliance-matrices/infrastructure/prisma-matrix-repository";
import { mapMatrixApiError } from "@/modules/compliance-matrices/presentation/matrix-api";

export async function GET(request: Request) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => { try { const authorization = await requirePermission("compliance-matrices.read"); const data = await new ComplianceMatrixService(new PrismaComplianceMatrixRepository()).list(authorization.actorId, context.correlationId); return NextResponse.json({ data, correlationId: context.correlationId }); } catch (error) { return toApiError(error); } });
}

export async function POST(request: Request) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => { try { const authorization = await requirePermission("compliance-matrices.create"); const data = await new ComplianceMatrixService(new PrismaComplianceMatrixRepository()).create(await request.json(), authorization.actorId, context.correlationId); return NextResponse.json({ data, correlationId: context.correlationId }, { status: 201 }); } catch (error) { try { mapMatrixApiError(error); } catch (mapped) { return toApiError(mapped); } } });
}
