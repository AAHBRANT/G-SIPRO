import { NextResponse } from "next/server";
import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { ArchiveSearchService } from "@/modules/technical-archive/application/archive-search-service";
import { PrismaArchiveSearchRepository } from "@/modules/technical-archive/infrastructure/prisma-archive-search-repository";

export async function GET(request: Request) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("technical-archive.search");
      const parameters = Object.fromEntries(new URL(request.url).searchParams.entries());
      const data = await new ArchiveSearchService(new PrismaArchiveSearchRepository()).search(parameters, authorization.actorId, context.correlationId);
      return NextResponse.json({ data, correlationId: context.correlationId });
    } catch (error) { return toApiError(error); }
  });
}

