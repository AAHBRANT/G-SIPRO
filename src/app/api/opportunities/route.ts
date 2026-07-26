import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { ConflictError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { OpportunityService } from "@/modules/opportunities/application/opportunity-service";
import { opportunityDraftSchema, opportunityStatuses } from "@/modules/opportunities/domain/opportunity";
import { detectDuplicateCandidates, duplicateDecisionSchema, isNearEmptyDraft } from "@/modules/opportunities/domain/duplicate-detection";
import { PrismaOpportunityRepository } from "@/modules/opportunities/infrastructure/prisma-opportunity-repository";
import { mapOpportunityApiError } from "@/modules/opportunities/presentation/opportunity-api";

const filtersSchema = z.object({
  status: z.enum(opportunityStatuses).optional(),
  ownerId: z.uuid().optional(),
  customerId: z.uuid().optional(),
  deliveryFrom: z.coerce.date().optional(),
  deliveryTo: z.coerce.date().optional(),
  minValue: z.coerce.number().nonnegative().optional(),
  maxValue: z.coerce.number().nonnegative().optional(),
  query: z.string().trim().max(100).optional(),
});

export async function GET(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      await requirePermission("opportunities.read");
      const url = new URL(request.url);
      const filters = filtersSchema.parse({
        status: url.searchParams.get("status") || undefined,
        ownerId: url.searchParams.get("ownerId") || undefined,
        customerId: url.searchParams.get("customerId") || undefined,
        deliveryFrom: url.searchParams.get("deliveryFrom") || undefined,
        deliveryTo: url.searchParams.get("deliveryTo") || undefined,
        minValue: url.searchParams.get("minValue") || undefined,
        maxValue: url.searchParams.get("maxValue") || undefined,
        query: url.searchParams.get("query") || undefined,
      });
      const data = await getDatabase().opportunity.findMany({
        where: {
          ...(filters.status && { status: filters.status }),
          ...(filters.ownerId && { ownerId: filters.ownerId }),
          ...(filters.customerId && { customerId: filters.customerId }),
          ...((filters.deliveryFrom || filters.deliveryTo) && {
            deliveryAt: { ...(filters.deliveryFrom && { gte: filters.deliveryFrom }), ...(filters.deliveryTo && { lte: filters.deliveryTo }) },
          }),
          ...((filters.minValue !== undefined || filters.maxValue !== undefined) && {
            estimatedValue: { ...(filters.minValue !== undefined && { gte: filters.minValue }), ...(filters.maxValue !== undefined && { lte: filters.maxValue }) },
          }),
          ...(filters.query && {
            OR: [
              { code: { contains: filters.query, mode: "insensitive" } },
              { subject: { contains: filters.query, mode: "insensitive" } },
            ],
          }),
        },
        include: { customer: true, contractingAuthority: true, owner: true },
        orderBy: [{ deliveryAt: "asc" }, { createdAt: "desc" }],
        take: 100,
      });
      return NextResponse.json({ data, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("opportunities.create");
      const body: unknown = await request.json();
      const draft = opportunityDraftSchema.parse(body);
      const decision = duplicateDecisionSchema.parse(body);
      const sources = await getDatabase().opportunity.findMany({
        where: { status: { not: "CLOSED" } },
        select: { id: true, code: true, subject: true, customerId: true, contractingAuthorityId: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      const candidates = detectDuplicateCandidates(
        draft,
        sources.map((source) => ({
          id: source.id,
          code: source.code,
          ...(source.subject && { subject: source.subject }),
          ...(source.customerId && { customerId: source.customerId }),
          ...(source.contractingAuthorityId && { contractingAuthorityId: source.contractingAuthorityId }),
        })),
      );
      if (candidates.length > 0 && decision.duplicateDecision !== "CREATE_SEPARATE") {
        throw new ConflictError("Foram encontradas possíveis oportunidades duplicadas.", {
          code: "POSSIBLE_DUPLICATE",
          candidates,
        });
      }
      if (candidates.length > 0 && !decision.duplicateJustification) {
        throw new ConflictError("A manutenção de registros separados exige justificativa.", {
          code: "DUPLICATE_JUSTIFICATION_REQUIRED",
          candidates,
        });
      }
      const service = new OpportunityService(new PrismaOpportunityRepository());
      const opportunity = await service.create(
        draft,
        authorization.actorId,
        context.correlationId,
        candidates.length > 0
          ? {
              decision: "CREATE_SEPARATE",
              justification: decision.duplicateJustification!,
              candidateIds: candidates.map((candidate) => candidate.id),
            }
          : undefined,
      );
      const warning = isNearEmptyDraft(draft) ? "Esta oportunidade está com poucos dados preenchidos — considere completar cliente, valor estimado e data de entrega." : undefined;
      return NextResponse.json({ data: opportunity, ...(warning && { warning }), correlationId: context.correlationId }, { status: 201 });
    } catch (error) {
      try {
        mapOpportunityApiError(error);
      } catch (mapped) {
        return toApiError(mapped);
      }
    }
  });
}
