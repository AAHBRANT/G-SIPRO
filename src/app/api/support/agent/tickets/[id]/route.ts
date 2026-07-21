import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDatabase } from "@/core/database/prisma";
import { ConflictError, ResourceNotFoundError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { Prisma } from "@/generated/prisma/client";
import { buildSupportExecutionPackage } from "@/modules/support/application/support-execution-package";
import { supportAgentCommandSchema } from "@/modules/support/domain/support-agent";
import { supportExecutionResolution } from "@/modules/support/domain/support-execution";
import { requireSupportExecutor } from "@/modules/support/infrastructure/support-executor-auth";

const include = {
  reporter: { select: { displayName: true, email: true } },
  attachments: { select: { id: true, fileName: true, fileHash: true, mimeType: true, sizeBytes: true } },
  decisions: { include: { decidedBy: { select: { displayName: true } } }, orderBy: { decidedAt: "desc" as const } },
  updates: { select: { note: true, toStatus: true, actorLabel: true, createdAt: true, createdBy: { select: { displayName: true } } }, orderBy: { createdAt: "asc" as const } },
};

export async function POST(request: Request, route: { params: Promise<{ id: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const actor = await requireSupportExecutor(request);
      const { id } = await route.params;
      const input = supportAgentCommandSchema.parse(await request.json());
      const database = getDatabase();

      if (input.action === "CLAIM") {
        const leaseId = randomUUID();
        await database.$transaction(async (transaction) => {
          const claimed = await transaction.supportTicket.updateMany({
            where: {
              id,
              executionLeaseId: null,
              resolutionAttempts: { lt: 3 },
              OR: [{ status: "TRIAGED", approvalRequired: false }, { status: "APPROVED" }],
            },
            data: {
              status: "IN_PROGRESS",
              executionLeaseId: leaseId,
              executorId: input.executorId,
              executionClaimedAt: new Date(),
              executionHeartbeatAt: new Date(),
              executionAttempts: { increment: 1 },
            },
          });
          if (claimed.count !== 1) throw new ConflictError("O chamado não está disponível ou já foi reservado por outro executor.");
          await transaction.supportTicketUpdate.create({
            data: { id: randomUUID(), ticketId: id, fromStatus: null, toStatus: "IN_PROGRESS", note: `Execução automatizada reservada por ${input.executorId}.`, actorLabel: input.executorId },
          });
          await transaction.auditEvent.create({
            data: { id: randomUUID(), actorType: actor.actorType, actorId: input.executorId, action: "SUPPORT_AGENT_CLAIMED", entityType: "SUPPORT_TICKET", entityId: id, correlationId: context.correlationId, outcome: "SUCCESS", origin: "support-agent", metadata: { leaseId, executorId: input.executorId } },
          });
        });
        const ticket = await database.supportTicket.findUnique({ where: { id }, include });
        if (!ticket) throw new ResourceNotFoundError("Chamado não encontrado.");
        return NextResponse.json({ data: { leaseId, package: buildSupportExecutionPackage(ticket) }, correlationId: context.correlationId });
      }

      const ticket = await database.supportTicket.findUnique({ where: { id } });
      if (!ticket) throw new ResourceNotFoundError("Chamado não encontrado.");
      if (ticket.status !== "IN_PROGRESS" || ticket.executionLeaseId !== input.leaseId || ticket.executorId !== input.executorId) {
        throw new ConflictError("A reserva do executor não corresponde ao chamado.");
      }

      if (input.action === "HEARTBEAT") {
        await database.supportTicket.update({ where: { id }, data: { executionHeartbeatAt: new Date() } });
        return NextResponse.json({ data: { id, status: ticket.status, heartbeat: true }, correlationId: context.correlationId });
      }

      if (input.action === "REPORT_PROGRESS") {
        const note = `${input.summary}${input.pullRequestUrl ? `\nPull Request: ${input.pullRequestUrl}` : ""}${input.revision ? `\nRevisão: ${input.revision}` : ""}`;
        await database.$transaction(async (transaction) => {
          await transaction.supportTicket.update({ where: { id }, data: { executionHeartbeatAt: new Date() } });
          await transaction.supportTicketUpdate.create({ data: { id: randomUUID(), ticketId: id, fromStatus: "IN_PROGRESS", toStatus: "IN_PROGRESS", note, actorLabel: input.executorId } });
          await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: actor.actorType, actorId: input.executorId, action: "SUPPORT_AGENT_PROGRESS", entityType: "SUPPORT_TICKET", entityId: id, correlationId: context.correlationId, outcome: "SUCCESS", origin: "support-agent", metadata: { leaseId: input.leaseId, pullRequestUrl: input.pullRequestUrl ?? null, revision: input.revision ?? null } } });
        });
        return NextResponse.json({ data: { id, status: "IN_PROGRESS", progress: true }, correlationId: context.correlationId });
      }

      const completed = input.action === "COMPLETE";
      const retryStatus = "TRIAGED";
      const note = completed
        ? supportExecutionResolution(input)
        : `Falha informada pelo executor ${input.executorId}: ${input.summary}`;
      await database.$transaction(async (transaction) => {
        const changed = await transaction.supportTicket.updateMany({
          where: { id, status: "IN_PROGRESS", executionLeaseId: input.leaseId, executorId: input.executorId },
          data: {
            status: completed ? "WAITING_USER_VALIDATION" : retryStatus,
            approvalRequired: false,
            approvalReason: null,
            resolution: completed ? note : ticket.resolution,
            resolvedAt: null,
            resolvedById: null,
            executionHeartbeatAt: new Date(),
            executionLeaseId: null,
            validationRequestedAt: completed ? new Date() : ticket.validationRequestedAt,
            validationQuestions: completed ? Prisma.JsonNull : undefined,
            resolutionAttempts: completed ? { increment: 1 } : undefined,
          },
        });
        if (changed.count !== 1) throw new ConflictError("A reserva expirou ou foi alterada.");
        await transaction.supportTicketUpdate.create({
          data: { id: randomUUID(), ticketId: id, fromStatus: "IN_PROGRESS", toStatus: completed ? "WAITING_USER_VALIDATION" : retryStatus, note: completed ? `${note}\n\nPosso encerrar este chamado? Aguardando validação do solicitante.` : note, actorLabel: input.executorId },
        });
        await transaction.auditEvent.create({
          data: {
            id: randomUUID(), actorType: actor.actorType, actorId: input.executorId,
            action: completed ? "SUPPORT_VALIDATION_REQUESTED" : "SUPPORT_AGENT_FAILED",
            entityType: "SUPPORT_TICKET", entityId: id, correlationId: context.correlationId,
            outcome: completed ? "SUCCESS" : "FAILURE", origin: "support-agent",
            metadata: completed ? { leaseId: input.leaseId, revision: input.revision ?? null, deploymentUrl: input.deploymentUrl ?? null, tests: input.tests } : { leaseId: input.leaseId, summary: input.summary },
          },
        });
      });
      return NextResponse.json({ data: { id, status: completed ? "WAITING_USER_VALIDATION" : retryStatus }, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
