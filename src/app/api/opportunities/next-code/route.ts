import { NextResponse } from "next/server";

import { requirePermission } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { nextOpportunityCode, opportunityCodePrefixSchema } from "@/modules/opportunities/domain/opportunity";

export async function GET(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      await requirePermission("opportunities.create");
      const prefix = opportunityCodePrefixSchema.parse(new URL(request.url).searchParams.get("prefix"));
      const existing = await getDatabase().opportunity.findMany({
        where: { code: { startsWith: prefix, mode: "insensitive" } },
        select: { code: true },
      });
      return NextResponse.json({ data: { code: nextOpportunityCode(prefix, existing.map(({ code }) => code.toUpperCase())) }, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
