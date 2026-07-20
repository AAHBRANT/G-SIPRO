import { NextResponse } from "next/server";
import { requirePermission } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { TechnicalEvidenceService } from "@/modules/technical-archive/application/technical-evidence-service";
import { PrismaTechnicalEvidenceRepository } from "@/modules/technical-archive/infrastructure/prisma-technical-evidence-repository";
import { mapTechnicalEvidenceApiError } from "@/modules/technical-archive/presentation/technical-evidence-api";

export async function GET(request: Request) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      await requirePermission("technical-archive.read");
      const data = await getDatabase().technicalEvidence.findMany({ include: { experience: true, documentVersion: { include: { document: true } }, relatedCat: true }, orderBy: [{ createdAt: "desc" }, { version: "desc" }] });
      return NextResponse.json({ data, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}

export async function POST(request: Request) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("technical-archive.create");
      const data = await new TechnicalEvidenceService(new PrismaTechnicalEvidenceRepository()).create(await request.json(), authorization.actorId, context.correlationId);
      return NextResponse.json({ data, correlationId: context.correlationId }, { status: 201 });
    } catch (error) {
      try { mapTechnicalEvidenceApiError(error); } catch (mapped) { return toApiError(mapped); }
    }
  });
}
