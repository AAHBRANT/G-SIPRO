import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { AuthorizationError, ResourceNotFoundError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { supportMessageSchema } from "@/modules/support/domain/support-ticket";

export async function POST(request: Request, route: { params: Promise<{ id: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await getCurrentAuthorizationContext();
      if (!authorization) throw new AuthorizationError("Autenticação corporativa obrigatória.");
      const ticketId = (await route.params).id;
      const input = supportMessageSchema.parse(await request.json());
      const database = getDatabase();
      const ticket = await database.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true, reporterId: true, status: true } });
      if (!ticket) throw new ResourceNotFoundError("Chamado não encontrado.");
      if (!authorization.isMaster && !authorization.isOwner && ticket.reporterId !== authorization.actorId) throw new AuthorizationError("Você não participa deste chamado.");

      const updateId = randomUUID();
      await database.$transaction(async transaction => {
        await transaction.supportTicketUpdate.create({ data: { id: updateId, ticketId, fromStatus: ticket.status, toStatus: ticket.status, note: input.message, createdById: authorization.actorId, actorLabel: "Mensagem" } });
        await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId: authorization.actorId, action: "SUPPORT_MESSAGE_SENT", entityType: "SUPPORT_TICKET", entityId: ticketId, correlationId: context.correlationId, outcome: "SUCCESS", origin: "support-chat", metadata: { updateId } } });
      });
      revalidatePath("/support");
      revalidatePath("/admin/support");
      return NextResponse.json({ data: { id: updateId }, correlationId: context.correlationId }, { status: 201 });
    } catch (error) { return toApiError(error); }
  });
}
