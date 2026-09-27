import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import { ConflictError, ResourceNotFoundError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { OpportunityService } from "@/modules/opportunities/application/opportunity-service";
import { inferPublicAuthorityFromValueSource } from "@/modules/opportunities/domain/public-authority-inference";
import { buildOpportunityEditorData } from "@/modules/opportunities/presentation/opportunity-editor-data";
import {
  detectDuplicateCandidates,
  duplicateDecisionSchema,
  isNearEmptyDraft,
} from "@/modules/opportunities/domain/duplicate-detection";
import { PrismaOpportunityRepository } from "@/modules/opportunities/infrastructure/prisma-opportunity-repository";
import { mapOpportunityApiError } from "@/modules/opportunities/presentation/opportunity-api";

/**
 * Pacote completo de UMA oportunidade, no mesmo formato que
 * `OpportunityEditor` consome — sob pedido, para a janelinha que o mapa da
 * Análise abre quando a licitação já foi aprovada. É a mesma conversão que
 * `opportunities/[id]/page.tsx` já fazia; ver `opportunity-editor-data.ts`.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("opportunities.read");
      const id = z.uuid().parse((await params).id);
      const [record, users] = await Promise.all([
        getDatabase().opportunity.findUnique({ where: { id }, include: { customer: true, contractingAuthority: true } }),
        getDatabase().user.findMany({ where: { status: "ACTIVE" }, select: { id: true, displayName: true }, orderBy: { displayName: "asc" } }),
      ]);
      if (!record) return toApiError(new ResourceNotFoundError("Oportunidade não encontrada."));

      return NextResponse.json({
        data: {
          opportunity: buildOpportunityEditorData(record),
          users: users.map((user) => ({ id: user.id, name: user.displayName })),
          canUpdate: authorize(authorization, { permission: "opportunities.update" }).allowed,
          canTransition: authorize(authorization, { permission: "opportunities.transition" }).allowed,
        },
        correlationId: context.correlationId,
      });
    } catch (error) {
      return toApiError(error);
    }
  });
}

export async function PATCH(request: Request, route: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("opportunities.update");
      const id = z.uuid().parse((await route.params).id);
      const service = new OpportunityService(new PrismaOpportunityRepository());
      const input = await request.json() as Record<string, unknown>;
      const authorityHintSource = typeof input.authorityNameHint === "string"
        ? input.authorityNameHint
        : typeof input.valueSource === "string" ? input.valueSource : undefined;
      const inferredAuthority = inferPublicAuthorityFromValueSource(authorityHintSource);
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

      const before = await getDatabase().opportunity.findUnique({
        where: { id },
        select: { origin: true, subject: true, customerId: true, contractingAuthorityId: true, estimatedValue: true, deliveryAt: true },
      });
      const effective = {
        origin: before?.origin,
        subject: typeof input.subject === "string" ? input.subject : before?.subject ?? undefined,
        customerId: typeof input.customerId === "string" ? input.customerId : before?.customerId ?? undefined,
        contractingAuthorityId: typeof input.contractingAuthorityId === "string" ? input.contractingAuthorityId : before?.contractingAuthorityId ?? undefined,
        estimatedValue: input.estimatedValue !== undefined
          ? Number(input.estimatedValue)
          : (before?.estimatedValue !== null && before?.estimatedValue !== undefined ? Number(before.estimatedValue) : undefined),
        deliveryAt: input.deliveryAt !== undefined ? new Date(String(input.deliveryAt)) : before?.deliveryAt ?? undefined,
      };
      const decision = duplicateDecisionSchema.parse(input);
      const sources = await getDatabase().opportunity.findMany({
        where: { status: { not: "CLOSED" }, id: { not: id } },
        select: { id: true, code: true, subject: true, customerId: true, contractingAuthorityId: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      const candidates = detectDuplicateCandidates(
        { origin: effective.origin ?? "PORTAL", subject: effective.subject, customerId: effective.customerId, contractingAuthorityId: effective.contractingAuthorityId },
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

      const opportunity = await service.update(
        id,
        input,
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
      const warning = isNearEmptyDraft(effective) ? "Esta oportunidade está com poucos dados preenchidos — considere completar cliente, valor estimado e data de entrega." : undefined;
      return NextResponse.json({ data: opportunity, ...(warning && { warning }), correlationId: context.correlationId });
    } catch (error) {
      try {
        mapOpportunityApiError(error);
      } catch (mapped) {
        return toApiError(mapped);
      }
    }
  });
}
