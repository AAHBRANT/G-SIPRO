import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireOwner } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { ConflictError, ResourceNotFoundError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";

export async function POST(request: Request, route: { params: Promise<{ id: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requireOwner();
      const id = (await route.params).id;
      const database = getDatabase();
      const ticket = await database.supportTicket.findUnique({ where: { id } });
      if (!ticket) throw new ResourceNotFoundError("Chamado não encontrado.");
      if (ticket.status !== "ESCALATED") throw new ConflictError("Este chamado não está escalado ao proprietário.");
      await database.$transaction(async transaction => {
        await transaction.supportTicket.update({ where: { id }, data: { status: "IN_PROGRESS", assignedToId: authorization.actorId, executionLeaseId: null, executorId: "proprietario", executionClaimedAt: new Date(), executionHeartbeatAt: new Date() } });
        await transaction.supportTicketUpdate.create({ data: { id: randomUUID(), ticketId: id, fromStatus: "ESCALATED", toStatus: "IN_PROGRESS", note: "O proprietário assumiu o chamado após três tentativas completas sem solução.", createdById: authorization.actorId, actorLabel: "Proprietário" } });
        await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId: authorization.actorId, action: "SUPPORT_ESCALATION_CLAIMED", entityType: "SUPPORT_TICKET", entityId: id, correlationId: context.correlationId, outcome: "SUCCESS", origin: "support-validation", metadata: { resolutionAttempts: ticket.resolutionAttempts } } });
      });
      revalidatePath("/support");
      revalidatePath("/admin/support");
      return NextResponse.json({ data: { id, status: "IN_PROGRESS" }, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
