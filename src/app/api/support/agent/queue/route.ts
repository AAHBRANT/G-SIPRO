import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@/core/database/prisma";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { buildSupportExecutionPackage } from "@/modules/support/application/support-execution-package";
import { supportLeaseCutoff, supportStatusAfterExpiredLease } from "@/modules/support/domain/support-lease";
import { requireSupportExecutor } from "@/modules/support/infrastructure/support-executor-auth";

const include = {
  reporter: { select: { displayName: true, email: true } },
  attachments: { select: { id: true, fileName: true, fileHash: true, mimeType: true, sizeBytes: true } },
  decisions: { include: { decidedBy: { select: { displayName: true } } }, orderBy: { decidedAt: "desc" as const } },
  updates: { select: { note: true, toStatus: true, actorLabel: true, createdAt: true, createdBy: { select: { displayName: true } } }, orderBy: { createdAt: "asc" as const } },
};

export async function GET(request: Request) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const actor = await requireSupportExecutor(request);
      const database = getDatabase();
      const legacyChanges = await database.supportTicket.findMany({
        where: {
          type: { in: ["IMPROVEMENT", "NEW_FEATURE"] },
          status: "TRIAGED",
          approvalRequired: false,
        },
        select: { id: true, status: true },
        take: 25,
      });
      for (const ticket of legacyChanges) {
        await database.$transaction(async transaction => {
          const corrected = await transaction.supportTicket.updateMany({
            where: { id: ticket.id, status: "TRIAGED", approvalRequired: false },
            data: {
              status: "WAITING_APPROVAL",
              approvalRequired: true,
              approvalReason: "Melhorias e novas funcionalidades exigem aprovação do proprietário antes da execução.",
              executionLeaseId: null,
              executorId: null,
              executionClaimedAt: null,
              executionHeartbeatAt: null,
            },
          });
          if (corrected.count !== 1) return;
          await transaction.supportTicketUpdate.create({
            data: {
              id: randomUUID(),
              ticketId: ticket.id,
              fromStatus: ticket.status,
              toStatus: "WAITING_APPROVAL",
              note: "Classificação corrigida: melhoria separada de correção de bug e encaminhada para aprovação do proprietário.",
              actorLabel: "support-watchdog",
            },
          });
        });
      }
      const cutoff = supportLeaseCutoff();
      const expiredLeases = await database.supportTicket.findMany({
        where: {
          status: "IN_PROGRESS",
          executionLeaseId: { not: null },
          OR: [
            { executionHeartbeatAt: { lt: cutoff } },
            { executionHeartbeatAt: null, executionClaimedAt: { lt: cutoff } },
          ],
        },
        select: { id: true, type: true, status: true, executionLeaseId: true, executorId: true, executionAttempts: true },
        take: 25,
      });
      for (const ticket of expiredLeases) {
        const nextStatus = supportStatusAfterExpiredLease({
          type: ticket.type,
          executionAttempts: ticket.executionAttempts,
        });
        await database.$transaction(async transaction => {
          const released = await transaction.supportTicket.updateMany({
            where: { id: ticket.id, status: "IN_PROGRESS", executionLeaseId: ticket.executionLeaseId },
            data: {
              status: nextStatus,
              executionLeaseId: null,
              executorId: null,
              executionClaimedAt: null,
              executionHeartbeatAt: null,
              escalatedAt: nextStatus === "ESCALATED" ? new Date() : null,
            },
          });
          if (released.count !== 1) return;
          const note = nextStatus === "ESCALATED"
            ? "A execução automática perdeu comunicação após três tentativas. O chamado foi escalado ao proprietário."
            : "A execução automática perdeu comunicação. A reserva foi liberada e o chamado retornou à fila sem intervenção do usuário.";
          await transaction.supportTicketUpdate.create({
            data: { id: randomUUID(), ticketId: ticket.id, fromStatus: ticket.status, toStatus: nextStatus, note, actorLabel: "support-watchdog" },
          });
          await transaction.auditEvent.create({
            data: {
              id: randomUUID(),
              actorType: actor.actorType,
              actorId: "support-watchdog",
              action: "SUPPORT_EXECUTION_LEASE_RECOVERED",
              entityType: "SUPPORT_TICKET",
              entityId: ticket.id,
              correlationId: context.correlationId,
              outcome: nextStatus === "ESCALATED" ? "FAILURE" : "SUCCESS",
              origin: "support-agent",
              metadata: { previousExecutorId: ticket.executorId, nextStatus, cutoff: cutoff.toISOString() },
            },
          });
        });
      }
      const tickets = await database.supportTicket.findMany({
        where: {
          executionLeaseId: null,
          executionAttempts: { lt: 3 },
          OR: [
            { status: "TRIAGED", approvalRequired: false, type: { in: ["BUG", "QUESTION"] } },
            { status: "APPROVED" },
            { status: "IN_PROGRESS", executorId: null },
          ],
        },
        include,
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        take: 25,
      });
      return NextResponse.json({
        data: tickets.map((ticket) => ({
          package: buildSupportExecutionPackage(ticket),
          claim: { method: "POST", path: `/api/support/agent/tickets/${ticket.id}`, body: { action: "CLAIM", executorId: "<executor-id>" } },
        })),
        correlationId: context.correlationId,
      });
    } catch (error) {
      return toApiError(error);
    }
  });
}
