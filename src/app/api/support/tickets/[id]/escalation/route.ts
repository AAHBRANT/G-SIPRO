import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { ConflictError, ResourceNotFoundError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";

const ownerActionSchema = z.object({ note: z.string().trim().min(3).max(2_000).optional() });

/**
 * Extraída da rota para ser testável sem sessão do NextAuth (requireOwner()
 * depende de cookies reais, inalcançáveis por um script) — ver
 * scripts/smoke-escalation-resets-attempts.ts.
 *
 * `executionAttempts` sempre volta a 0: tanto ao devolver o chamado à fila
 * automática (externalActionCompleted) quanto ao ser assumido manualmente
 * pelo proprietário, é o início de um ciclo novo. Deixar o valor antigo (3)
 * no segundo caso deixava o chamado com tentativas esgotadas para sempre —
 * nenhuma rota de agente aceita reivindicar ou reprocessar um chamado com
 * executionAttempts >= 3, e a varredura de reservas expiradas exige
 * executionLeaseId não-nulo, que esta própria atualização zera. Um chamado
 * assim ficava sem nenhum caminho automático de volta.
 */
export async function resolveOwnerEscalation({ database, ticketId, actorId, note, correlationId }: { database: PrismaClient; ticketId: string; actorId: string; note: string | undefined; correlationId: string }): Promise<{ status: "TRIAGED" | "IN_PROGRESS" }> {
  const ticket = await database.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new ResourceNotFoundError("Chamado não encontrado.");
  if (!["ESCALATED", "OWNER_ACTION_REQUIRED"].includes(ticket.status)) throw new ConflictError("Este chamado não requer atuação do proprietário.");
  const externalActionCompleted = ticket.status === "OWNER_ACTION_REQUIRED";
  if (externalActionCompleted && !note) throw new ConflictError("Informe o que foi executado no ambiente externo.");
  const nextStatus = externalActionCompleted ? "TRIAGED" : "IN_PROGRESS";
  const updateNote = externalActionCompleted
    ? `O proprietário confirmou a ação externa: ${note}. O chamado retornou automaticamente à GUULY para validação e continuidade.`
    : "O proprietário assumiu o chamado após três tentativas completas sem solução.";
  await database.$transaction(async transaction => {
    await transaction.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: nextStatus,
        assignedToId: externalActionCompleted ? null : actorId,
        executionLeaseId: null,
        executorId: externalActionCompleted ? null : "proprietario",
        executionClaimedAt: externalActionCompleted ? null : new Date(),
        executionHeartbeatAt: externalActionCompleted ? null : new Date(),
        executionAttempts: 0,
        externalBlocker: externalActionCompleted ? Prisma.JsonNull : undefined,
        ownerActionRequiredAt: externalActionCompleted ? null : undefined,
      },
    });
    await transaction.supportTicketUpdate.create({ data: { id: randomUUID(), ticketId, fromStatus: ticket.status, toStatus: nextStatus, note: updateNote, createdById: actorId, actorLabel: "Proprietário" } });
    await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId, action: externalActionCompleted ? "SUPPORT_OWNER_ACTION_CONFIRMED" : "SUPPORT_ESCALATION_CLAIMED", entityType: "SUPPORT_TICKET", entityId: ticketId, correlationId, outcome: "SUCCESS", origin: "support-validation", metadata: { resolutionAttempts: ticket.resolutionAttempts, note: note ?? null } } });
  });
  return { status: nextStatus };
}

export async function POST(request: Request, route: { params: Promise<{ id: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requireOwner();
      const id = (await route.params).id;
      const input = ownerActionSchema.parse(await request.json().catch(() => ({})));
      const database = getDatabase();
      const { status } = await resolveOwnerEscalation({ database, ticketId: id, actorId: authorization.actorId, note: input.note, correlationId: context.correlationId });
      revalidatePath("/support");
      revalidatePath("/admin/support");
      return NextResponse.json({ data: { id, status }, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
