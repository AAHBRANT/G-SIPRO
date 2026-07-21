import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireOwner } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { ConflictError, ResourceNotFoundError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { Prisma } from "@/generated/prisma/client";
import { supportReopenSchema } from "@/modules/support/domain/support-ticket";

export async function POST(request: Request, route: { params: Promise<{ id: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requireOwner();
      const ticketId = (await route.params).id;
      const input = supportReopenSchema.parse(await request.json());
      const database = getDatabase();
      const ticket = await database.supportTicket.findUnique({ where: { id: ticketId } });
      if (!ticket) throw new ResourceNotFoundError("Chamado não encontrado.");
      if (ticket.status !== "RESOLVED") throw new ConflictError("Somente chamados resolvidos podem ser reabertos.");
      const nextStatus = "TRIAGED";
      await database.$transaction(async transaction => {
        await transaction.supportTicket.update({ where: { id: ticketId }, data: { status: nextStatus, approvalRequired: false, approvalReason: null, resolution: null, resolvedAt: null, resolvedById: null, assignedToId: null, executionLeaseId: null, executorId: null, executionClaimedAt: null, executionHeartbeatAt: null, executionAttempts: 0, resolutionAttempts: 0, validationQuestions: Prisma.JsonNull, validationRequestedAt: null, escalatedAt: null } });
        await transaction.supportTicketUpdate.create({ data: { id: randomUUID(), ticketId, fromStatus: "RESOLVED", toStatus: nextStatus, note: `Reabertura aceita. A IA iniciará automaticamente uma nova sequência de até três tentativas. Motivo: ${input.note}`, createdById: authorization.actorId, actorLabel: "Proprietário" } });
        await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId: authorization.actorId, action: "SUPPORT_TICKET_REOPENED", entityType: "SUPPORT_TICKET", entityId: ticketId, correlationId: context.correlationId, outcome: "SUCCESS", origin: "support-governance", metadata: { reason: input.note, nextStatus } } });
      });
      revalidatePath("/support");
      revalidatePath("/admin/support");
      return NextResponse.json({ data: { id: ticketId, status: nextStatus }, correlationId: context.correlationId });
    } catch (error) { return toApiError(error); }
  });
}
