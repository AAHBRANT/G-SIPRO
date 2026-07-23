import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireOwner } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { ConflictError, ResourceNotFoundError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { supportDecisionSchema } from "@/modules/support/domain/support-ticket";

export async function POST(request: Request, route: { params: Promise<{ id: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requireOwner();
      const { id } = await route.params;
      const input = supportDecisionSchema.parse(await request.json());
      const database = getDatabase();
      const ticket = await database.supportTicket.findUnique({ where: { id } });
      if (!ticket) throw new ResourceNotFoundError("Chamado não encontrado.");
      if (!ticket.approvalRequired || ticket.status !== "WAITING_APPROVAL") throw new ConflictError("Este chamado não está aguardando aprovação.");
      const nextStatus = input.decision === "APPROVED" ? "APPROVED" : "REJECTED";
      await database.$transaction(async transaction => {
        await transaction.supportTicketDecision.create({ data: { id: randomUUID(), ticketId: id, decision: input.decision, note: input.note, decidedById: authorization.actorId } });
        await transaction.supportTicket.update({ where: { id }, data: { status: nextStatus, approvalRequired: false, assignedToId: input.decision === "APPROVED" ? authorization.actorId : null } });
        await transaction.supportTicketUpdate.create({ data: { id: randomUUID(), ticketId: id, fromStatus: ticket.status, toStatus: nextStatus, note: input.decision === "APPROVED" ? `Aprovado pelo proprietário. A execução automática foi liberada. ${input.note}` : `Rejeitado pelo proprietário. ${input.note}`, createdById: authorization.actorId, actorLabel: "Proprietário" } });
        await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId: authorization.actorId, action: input.decision === "APPROVED" ? "SUPPORT_CHANGE_APPROVED" : "SUPPORT_CHANGE_REJECTED", entityType: "SUPPORT_TICKET", entityId: id, correlationId: context.correlationId, outcome: "SUCCESS", origin: "support-approvals", metadata: { note: input.note } } });
      });
      return NextResponse.json({ data: { id, status: nextStatus }, correlationId: context.correlationId });
    } catch (error) { return toApiError(error); }
  });
}
