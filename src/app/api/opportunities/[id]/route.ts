import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { OpportunityService } from "@/modules/opportunities/application/opportunity-service";
import { inferPublicAuthorityFromValueSource } from "@/modules/opportunities/domain/public-authority-inference";
import { PrismaOpportunityRepository } from "@/modules/opportunities/infrastructure/prisma-opportunity-repository";
import { mapOpportunityApiError } from "@/modules/opportunities/presentation/opportunity-api";

export async function PATCH(request: Request, route: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("opportunities.update");
      const id = z.uuid().parse((await route.params).id);
      const service = new OpportunityService(new PrismaOpportunityRepository());
      const input = await request.json() as Record<string, unknown>;
      const inferredAuthority = inferPublicAuthorityFromValueSource(
        typeof input.valueSource === "string" ? input.valueSource : undefined,
      );
      if (!input.contractingAuthorityId && inferredAuthority) {
        const database = getDatabase();
        const existingAuthority = await database.contractingAuthority.findFirst({
          where: { name: { equals: inferredAuthority.name, mode: "insensitive" }, active: true },
        });
        const authority = existingAuthority ?? await database.contractingAuthority.create({
          data: {
            name: inferredAuthority.name,
            sphere: inferredAuthority.sphere,
            locality: inferredAuthority.locality,
            createdBy: authorization.actorId,
            updatedBy: authorization.actorId,
          },
        });
        input.contractingAuthorityId = authority.id;
      }
      const opportunity = await service.update(id, input, authorization.actorId, context.correlationId);
      return NextResponse.json({ data: opportunity, correlationId: context.correlationId });
    } catch (error) {
      try {
        mapOpportunityApiError(error);
      } catch (mapped) {
        return toApiError(mapped);
      }
    }
  });
}
