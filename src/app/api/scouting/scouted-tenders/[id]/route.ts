import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import { ResourceNotFoundError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { findDuplicates } from "@/modules/scouting/domain/duplicates";
import { scoreTender } from "@/modules/scouting/application/score-tender";
import { PrismaArchiveEvidenceRepository, PrismaScoutRepository } from "@/modules/scouting/infrastructure/prisma-scouting-repository";
import { defaultScoutFilter } from "@/modules/scouting/domain/scout-filter";

/**
 * Pacote completo de UMA licitação rastreada, sob pedido — a mesma conta que
 * a fila do Buscador faz para todas de uma vez (`opportunities/scouted/page.tsx`),
 * só que para uma. Existe para a janelinha que o mapa da Análise abre: sem
 * isto, a única forma de montar esses dados era carregar a fila inteira.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("opportunities.read");
      const id = z.uuid().parse((await params).id);
      const database = getDatabase();

      const [tender, filterRow, archive, activeUsers, pendingFacets] = await Promise.all([
        database.scoutedTender.findUnique({ where: { id }, include: { signal: true, editalReading: true } }),
        new PrismaScoutRepository().loadFilter(),
        new PrismaArchiveEvidenceRepository().loadEvidence(),
        database.user.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, displayName: true, email: true },
          orderBy: { displayName: "asc" },
        }),
        database.scoutedTender.findMany({
          where: { status: "PENDING" },
          select: { id: true, authorityDocument: true, authorityName: true, processNumber: true, subject: true },
        }),
      ]);
      if (!tender) return toApiError(new ResourceNotFoundError("Licitação rastreada não encontrada."));

      const now = new Date();
      const scored = scoreTender(tender, filterRow ?? defaultScoutFilter, archive, now);
      const duplicateGroups = findDuplicates(pendingFacets.map((entry) => ({
        id: entry.id,
        ...(entry.authorityDocument ? { authorityDocument: entry.authorityDocument } : {}),
        authorityName: entry.authorityName,
        ...(entry.processNumber ? { processNumber: entry.processNumber } : {}),
        subject: entry.subject,
      })));

      const canDecide = authorize(authorization, { permission: "opportunities.create" }).allowed;
      const shareRecipients = activeUsers.map((user) => ({ id: user.id, email: user.email, label: `${user.displayName} (${user.email})` }));

      return NextResponse.json({
        data: { tender: scored, canDecide, shareRecipients, duplicateCount: duplicateGroups.get(id)?.length ?? 0 },
        correlationId: context.correlationId,
      });
    } catch (error) {
      return toApiError(error);
    }
  });
}
