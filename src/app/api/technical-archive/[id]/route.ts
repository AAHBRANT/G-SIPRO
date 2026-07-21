import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { archiveDeletionSchema } from "@/modules/technical-archive/domain/archive-deletion";

export async function DELETE(request: Request, route: { params: Promise<{ id: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("technical-archive.delete");
      const id = z.uuid().parse((await route.params).id);
      const input = archiveDeletionSchema.parse(await request.json());
      const database = getDatabase();
      const current = await database.managedDocument.findFirst({
        where: { id, type: "ATESTADO", status: { not: "DELETED" } },
        include: { _count: { select: { versions: true, links: true } } },
      });
      if (!current) return NextResponse.json({ error: { message: "Acervo técnico não encontrado." } }, { status: 404 });

      await database.$transaction(async (transaction) => {
        await transaction.managedDocument.update({
          where: { id },
          data: { status: "DELETED", updatedBy: authorization.actorId },
        });
        await transaction.auditEvent.create({
          data: {
            id: randomUUID(), actorType: "USER", actorId: authorization.actorId,
            action: "TECHNICAL_ARCHIVE_DELETED", entityType: "MANAGED_DOCUMENT", entityId: id,
            correlationId: context.correlationId, outcome: "SUCCESS", origin: "technical-archive",
            metadata: { reason: input.reason, previousStatus: current.status, softDelete: true, versions: current._count.versions, links: current._count.links },
          },
        });
      });
      return NextResponse.json({ data: { id, deleted: true, preserved: true }, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
