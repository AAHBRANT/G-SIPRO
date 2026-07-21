import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireMaster } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { ConflictError, ResourceNotFoundError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { Prisma } from "@/generated/prisma/client";
import { buildSupportExecutionPackage } from "@/modules/support/application/support-execution-package";
import { supportExecutionAuthorization, supportExecutionCommandSchema, supportExecutionResolution } from "@/modules/support/domain/support-execution";

const include = {
  reporter: { select: { displayName: true, email: true } },
  attachments: { select: { id: true, fileName: true, fileHash: true, mimeType: true, sizeBytes: true } },
  decisions: { include: { decidedBy: { select: { displayName: true } } }, orderBy: { decidedAt: "desc" as const } },
  updates: { select: { note: true, toStatus: true, actorLabel: true, createdAt: true, createdBy: { select: { displayName: true } } }, orderBy: { createdAt: "asc" as const } },
};

export async function GET(request: Request, route: { params: Promise<{ id: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      await requireMaster();
      const ticket = await getDatabase().supportTicket.findUnique({ where: { id: (await route.params).id }, include });
      if (!ticket) throw new ResourceNotFoundError("Chamado não encontrado.");
      if (!supportExecutionAuthorization(ticket).allowed) throw new ConflictError("A execução ainda não foi autorizada para este chamado.");
      return NextResponse.json({ data: buildSupportExecutionPackage(ticket), correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}

export async function POST(request: Request, route: { params: Promise<{ id: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requireMaster();
      const { id } = await route.params;
      const input = supportExecutionCommandSchema.parse(await request.json());
      const database = getDatabase();
      const ticket = await database.supportTicket.findUnique({ where: { id } });
      if (!ticket) throw new ResourceNotFoundError("Chamado não encontrado.");
      const execution = supportExecutionAuthorization(ticket);

      if (input.action === "CLAIM" && !execution.ready) throw new ConflictError("O chamado não está disponível para início da execução.");
      if (input.action !== "CLAIM" && !execution.claimed) throw new ConflictError("O chamado não está em execução.");

      const nextStatus = input.action === "COMPLETE" ? "WAITING_USER_VALIDATION" : "IN_PROGRESS";
      const note = input.action === "CLAIM"
        ? "Chamado assumido pela fila técnica para correção e validação."
        : input.action === "COMPLETE"
          ? `${supportExecutionResolution(input)}\n\nPosso encerrar este chamado? Aguardando validação do solicitante.`
          : `Falha informada pela execução técnica: ${input.summary}`;

      await database.$transaction(async (transaction) => {
        await transaction.supportTicket.update({
          where: { id },
          data: {
            status: nextStatus,
            assignedToId: authorization.actorId,
            resolution: input.action === "COMPLETE" ? note : ticket.resolution,
            resolvedAt: null,
            resolvedById: null,
            validationRequestedAt: input.action === "COMPLETE" ? new Date() : ticket.validationRequestedAt,
            validationQuestions: input.action === "COMPLETE" ? Prisma.JsonNull : undefined,
            resolutionAttempts: input.action === "COMPLETE" && ticket.resolutionAttempts < 3 ? { increment: 1 } : undefined,
            executionLeaseId: input.action === "COMPLETE" ? null : undefined,
            executorId: input.action === "COMPLETE" ? null : undefined,
            executionClaimedAt: input.action === "COMPLETE" ? null : undefined,
            executionHeartbeatAt: input.action === "COMPLETE" ? null : undefined,
          },
        });
        await transaction.supportTicketUpdate.create({
          data: { id: randomUUID(), ticketId: id, fromStatus: ticket.status, toStatus: nextStatus, note, createdById: authorization.actorId },
        });
        await transaction.auditEvent.create({
          data: {
            id: randomUUID(), actorType: "USER", actorId: authorization.actorId,
            action: input.action === "CLAIM" ? "SUPPORT_EXECUTION_CLAIMED" : input.action === "COMPLETE" ? "SUPPORT_VALIDATION_REQUESTED" : "SUPPORT_EXECUTION_FAILED",
            entityType: "SUPPORT_TICKET", entityId: id, correlationId: context.correlationId,
            outcome: input.action === "REPORT_FAILURE" ? "FAILURE" : "SUCCESS", origin: "support-execution-bridge",
            metadata: input.action === "COMPLETE" ? { revision: input.revision ?? null, deploymentUrl: input.deploymentUrl ?? null, tests: input.tests } : { note },
          },
        });
      });
      return NextResponse.json({ data: { id, status: nextStatus }, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
