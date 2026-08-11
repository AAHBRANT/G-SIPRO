import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { AuthorizationError, ResourceNotFoundError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { supportAssistantCommandSchema, supportAssistantDisposition } from "@/modules/support/domain/support-assistant";

export async function POST(request: Request, route: { params: Promise<{ id: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await getCurrentAuthorizationContext();
      if (!authorization) throw new AuthorizationError("Autenticação corporativa obrigatória.");
      const ticketId = (await route.params).id;
      const input = supportAssistantCommandSchema.parse(await request.json());
      const database = getDatabase();
      const ticket = await database.supportTicket.findUnique({
        where: { id: ticketId },
        select: { id: true, reporterId: true, status: true, executorId: true },
      });
      if (!ticket) throw new ResourceNotFoundError("Chamado não encontrado.");
      if (!authorization.isMaster && !authorization.isOwner && ticket.reporterId !== authorization.actorId) {
        throw new AuthorizationError("Você não participa deste chamado.");
      }

      const disposition = supportAssistantDisposition(ticket.status, Boolean(authorization.isOwner), ticket.executorId);
      const nextStatus = disposition.nextStatus ?? ticket.status;
      const userUpdateId = randomUUID();
      const assistantUpdateId = randomUUID();

      await database.$transaction(async transaction => {
        if (disposition.nextStatus) {
          await transaction.supportTicket.update({
            where: { id: ticketId },
            data: {
              status: disposition.nextStatus,
              assignedToId: null,
              executionLeaseId: null,
              executorId: null,
              executionClaimedAt: null,
              executionHeartbeatAt: null,
              executionAttempts: disposition.resetExecution ? 0 : undefined,
              escalatedAt: disposition.resetExecution ? null : undefined,
            },
          });
        }
        await transaction.supportTicketUpdate.createMany({
          data: [
            {
              id: userUpdateId,
              ticketId,
              fromStatus: ticket.status,
              toStatus: nextStatus,
              note: input.message,
              createdById: authorization.actorId,
              actorLabel: "Solicitante",
            },
            {
              id: assistantUpdateId,
              ticketId,
              fromStatus: nextStatus,
              toStatus: nextStatus,
              note: disposition.response,
              actorLabel: "GUULY do G-SIPRO",
            },
          ],
        });
        await transaction.auditEvent.create({
          data: {
            id: randomUUID(),
            actorType: "USER",
            actorId: authorization.actorId,
            action: disposition.nextStatus ? "SUPPORT_ASSISTANT_QUEUED" : "SUPPORT_ASSISTANT_MESSAGE",
            entityType: "SUPPORT_TICKET",
            entityId: ticketId,
            correlationId: context.correlationId,
            outcome: "SUCCESS",
            origin: "support-assistant",
            metadata: { previousStatus: ticket.status, nextStatus, resetExecution: disposition.resetExecution ?? false },
          },
        });
      });

      revalidatePath("/support");
      revalidatePath("/admin/support");
      return NextResponse.json({
        data: { id: assistantUpdateId, status: nextStatus, response: disposition.response },
        correlationId: context.correlationId,
      }, { status: 201 });
    } catch (error) {
      return toApiError(error);
    }
  });
}
