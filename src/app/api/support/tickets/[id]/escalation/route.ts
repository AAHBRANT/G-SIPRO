import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { ConflictError, ResourceNotFoundError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { Prisma } from "@/generated/prisma/client";

const ownerActionSchema = z.object({ note: z.string().trim().min(3).max(2_000).optional() });

export async function POST(request: Request, route: { params: Promise<{ id: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requireOwner();
      const id = (await route.params).id;
      const input = ownerActionSchema.parse(await request.json().catch(() => ({})));
      const database = getDatabase();
      const ticket = await database.supportTicket.findUnique({ where: { id } });
      if (!ticket) throw new ResourceNotFoundError("Chamado não encontrado.");
      if (!["ESCALATED", "OWNER_ACTION_REQUIRED"].includes(ticket.status)) throw new ConflictError("Este chamado não requer atuação do proprietário.");
      const externalActionCompleted = ticket.status === "OWNER_ACTION_REQUIRED";
      if (externalActionCompleted && !input.note) throw new ConflictError("Informe o que foi executado no ambiente externo.");
      const nextStatus = externalActionCompleted ? "TRIAGED" : "IN_PROGRESS";
      const note = externalActionCompleted
        ? `O proprietário confirmou a ação externa: ${input.note}. O chamado retornou automaticamente à IA para validação e continuidade.`
        : "O proprietário assumiu o chamado após três tentativas completas sem solução.";
      await database.$transaction(async transaction => {
        await transaction.supportTicket.update({
          where: { id },
          data: {
            status: nextStatus,
            assignedToId: externalActionCompleted ? null : authorization.actorId,
            executionLeaseId: null,
            executorId: externalActionCompleted ? null : "proprietario",
            executionClaimedAt: externalActionCompleted ? null : new Date(),
            executionHeartbeatAt: externalActionCompleted ? null : new Date(),
            externalBlocker: externalActionCompleted ? Prisma.JsonNull : undefined,
            ownerActionRequiredAt: externalActionCompleted ? null : undefined,
          },
        });
        await transaction.supportTicketUpdate.create({ data: { id: randomUUID(), ticketId: id, fromStatus: ticket.status, toStatus: nextStatus, note, createdById: authorization.actorId, actorLabel: "Proprietário" } });
        await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId: authorization.actorId, action: externalActionCompleted ? "SUPPORT_OWNER_ACTION_CONFIRMED" : "SUPPORT_ESCALATION_CLAIMED", entityType: "SUPPORT_TICKET", entityId: id, correlationId: context.correlationId, outcome: "SUCCESS", origin: "support-validation", metadata: { resolutionAttempts: ticket.resolutionAttempts, note: input.note ?? null } } });
      });
      revalidatePath("/support");
      revalidatePath("/admin/support");
      return NextResponse.json({ data: { id, status: nextStatus }, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
