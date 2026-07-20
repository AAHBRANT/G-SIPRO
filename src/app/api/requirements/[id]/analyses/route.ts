import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { AnalysisService } from "@/modules/analyses/application/analysis-service";
import { PrismaAnalysisRepository } from "@/modules/analyses/infrastructure/prisma-analysis-repository";
import { mapAnalysisApiError } from "@/modules/analyses/presentation/analysis-api";

export async function GET(request: Request, route: { params: Promise<{ id: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => { try {
    await requirePermission("analyses.read"); const id = z.uuid().parse((await route.params).id);
    const data = await getDatabase().requirementAnalysis.findMany({ where: { requirementId: id }, include: { assignee: true, decidedBy: true, history: true }, orderBy: { competence: "asc" } });
    return NextResponse.json({ data, correlationId: context.correlationId });
  } catch (error) { return toApiError(error); } });
}
export async function POST(request: Request, route: { params: Promise<{ id: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => { try {
    const authorization = await requirePermission("analyses.create"); const requirementId = z.uuid().parse((await route.params).id);
    const input = await request.json() as Record<string, unknown>;
    const data = await new AnalysisService(new PrismaAnalysisRepository()).create({ ...input, requirementId }, authorization.actorId, context.correlationId);
    return NextResponse.json({ data, correlationId: context.correlationId }, { status: 201 });
  } catch (error) { try { mapAnalysisApiError(error); } catch (mapped) { return toApiError(mapped); } } });
}
