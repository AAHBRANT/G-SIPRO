import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireMaster } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { ConflictError, ResourceNotFoundError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { supportStatusSchema } from "@/modules/support/domain/support-ticket";

const transitions: Record<string, string[]> = { OPEN: ["IN_PROGRESS", "CANCELLED"], TRIAGED: ["IN_PROGRESS", "RESOLVED", "CANCELLED"], APPROVED: ["IN_PROGRESS", "CANCELLED"], IN_PROGRESS: ["RESOLVED", "CANCELLED"] };

export async function POST(request: Request, route: { params: Promise<{ id: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requireMaster();
      const { id } = await route.params;
      const input = supportStatusSchema.parse(await request.json());
      const database = getDatabase();
      const ticket = await database.supportTicket.findUnique({ where: { id } });
      if (!ticket) throw new ResourceNotFoundError("Chamado não encontrado.");
      if (!transitions[ticket.status]?.includes(input.status)) throw new ConflictError("Transição de situação não permitida.");
      await database.$transaction(async transaction => {
        await transaction.supportTicket.update({ where: { id }, data: { status: input.status, assignedToId: authorization.actorId, resolution: input.status === "RESOLVED" ? input.note : ticket.resolution, resolvedAt: input.status === "RESOLVED" ? new Date() : null, resolvedById: input.status === "RESOLVED" ? authorization.actorId : null } });
        await transaction.supportTicketUpdate.create({ data: { id: randomUUID(), ticketId: id, fromStatus: ticket.status, toStatus: input.status, note: input.note, createdById: authorization.actorId } });
        await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId: authorization.actorId, action: `SUPPORT_TICKET_${input.status}`, entityType: "SUPPORT_TICKET", entityId: id, correlationId: context.correlationId, outcome: "SUCCESS", origin: "support-center", metadata: { note: input.note } } });
      });
      return NextResponse.json({ data: { id, status: input.status }, correlationId: context.correlationId });
    } catch (error) { return toApiError(error); }
  });
}
