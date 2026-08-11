import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { AuthorizationError, ConflictError, ResourceNotFoundError, ValidationError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { Prisma } from "@/generated/prisma/client";
import { supportClarificationSchema, supportValidationSchema, type SupportClarification } from "@/modules/support/domain/support-ticket";
import { CentralIaSupportProvider } from "@/modules/support/infrastructure/central-ia-support-provider";

const fallbackClarification: SupportClarification = {
  introduction: "Para encaminhar a correção com precisão, confirme os pontos abaixo.",
  questions: [
    { id: "observed-behavior", question: "O que acontece agora ao repetir a operação?", options: ["O mesmo erro continua", "O erro mudou", "A operação funciona parcialmente"] },
    { id: "environment", question: "Onde o problema foi testado?", options: ["No Microsoft Teams", "No navegador", "Nos dois ambientes"] },
    { id: "frequency", question: "Com que frequência o problema ocorre?", options: ["Sempre", "Às vezes", "Somente com um arquivo ou registro específico"] },
  ],
};

export async function POST(request: Request, route: { params: Promise<{ id: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await getCurrentAuthorizationContext();
      if (!authorization) throw new AuthorizationError("Autenticação corporativa obrigatória.");
      const id = (await route.params).id;
      const input = supportValidationSchema.parse(await request.json());
      const database = getDatabase();
      const ticket = await database.supportTicket.findUnique({ where: { id } });
      if (!ticket) throw new ResourceNotFoundError("Chamado não encontrado.");
      if (ticket.reporterId !== authorization.actorId) throw new AuthorizationError("Somente o solicitante pode validar a solução.");
      if (ticket.status !== "WAITING_USER_VALIDATION") throw new ConflictError("Este chamado não está aguardando validação do solicitante.");

      if (input.action === "CONFIRM_RESOLVED") {
        await database.$transaction(async transaction => {
          await transaction.supportTicket.update({ where: { id }, data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: authorization.actorId, validationQuestions: Prisma.JsonNull, validationRequestedAt: null } });
          await transaction.supportTicketUpdate.create({ data: { id: randomUUID(), ticketId: id, fromStatus: "WAITING_USER_VALIDATION", toStatus: "RESOLVED", note: "Problema resolvido. O solicitante confirmou o encerramento do chamado com êxito.", createdById: authorization.actorId, actorLabel: "Solicitante" } });
          await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId: authorization.actorId, action: "SUPPORT_RESOLUTION_CONFIRMED", entityType: "SUPPORT_TICKET", entityId: id, correlationId: context.correlationId, outcome: "SUCCESS", origin: "support-validation", metadata: { resolutionAttempts: ticket.resolutionAttempts } } });
        });
        revalidate();
        return NextResponse.json({ data: { id, status: "RESOLVED" }, correlationId: context.correlationId });
      }

      if (input.action === "REPORT_UNRESOLVED") {
        if (ticket.validationQuestions) throw new ConflictError("As perguntas de esclarecimento já foram geradas.");
        let clarification = fallbackClarification;
        try {
          clarification = await new CentralIaSupportProvider().clarify({ title: ticket.title, description: ticket.description, errorMessage: ticket.errorMessage, stepsToReproduce: ticket.stepsToReproduce, resolution: ticket.resolution, reason: input.reason, attempt: ticket.resolutionAttempts }, context.correlationId);
        } catch {
          clarification = fallbackClarification;
        }
        await database.$transaction(async transaction => {
          await transaction.supportTicket.update({ where: { id }, data: { validationQuestions: clarification } });
          await transaction.supportTicketUpdate.create({ data: { id: randomUUID(), ticketId: id, fromStatus: ticket.status, toStatus: ticket.status, note: `O problema ainda não foi resolvido. Motivo informado: ${input.reason}`, createdById: authorization.actorId, actorLabel: "Solicitante" } });
          await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId: authorization.actorId, action: "SUPPORT_RESOLUTION_REJECTED", entityType: "SUPPORT_TICKET", entityId: id, correlationId: context.correlationId, outcome: "SUCCESS", origin: "support-validation", metadata: { resolutionAttempts: ticket.resolutionAttempts, questionCount: clarification.questions.length } } });
        });
        revalidate();
        return NextResponse.json({ data: { id, status: ticket.status, clarification }, correlationId: context.correlationId });
      }

      const clarification = supportClarificationSchema.safeParse(ticket.validationQuestions);
      if (!clarification.success) throw new ConflictError("As perguntas de esclarecimento ainda não foram geradas.");
      const answers = new Map(input.answers.map(answer => [answer.questionId, answer.answer]));
      const missing = clarification.data.questions.filter(question => !answers.has(question.id));
      if (missing.length) throw new ValidationError("Responda todas as perguntas antes de continuar.");
      const escalated = ticket.resolutionAttempts >= 3;
      const nextStatus = escalated ? "ESCALATED" : "TRIAGED";
      const details = clarification.data.questions.map(question => `${question.question}\nResposta: ${answers.get(question.id)}`).join("\n\n");
      const note = escalated
        ? `Terceira tentativa não solucionou o problema. Chamado escalado automaticamente ao proprietário.\n\n${details}`
        : `Reabertura aceita. Os esclarecimentos foram registrados e a GUULY iniciará automaticamente a tentativa ${Math.min(3, ticket.resolutionAttempts + 1)} de 3, sem nova aprovação.\n\n${details}`;
      await database.$transaction(async transaction => {
        await transaction.supportTicket.update({ where: { id }, data: { status: nextStatus, approvalRequired: false, approvalReason: null, validationQuestions: Prisma.JsonNull, validationRequestedAt: null, escalatedAt: escalated ? new Date() : null, executionLeaseId: null, executorId: null, executionClaimedAt: null, executionHeartbeatAt: null } });
        await transaction.supportTicketUpdate.create({ data: { id: randomUUID(), ticketId: id, fromStatus: "WAITING_USER_VALIDATION", toStatus: nextStatus, note, createdById: authorization.actorId, actorLabel: "Solicitante" } });
        await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId: authorization.actorId, action: escalated ? "SUPPORT_ESCALATED_TO_OWNER" : "SUPPORT_CLARIFICATION_COMPLETED", entityType: "SUPPORT_TICKET", entityId: id, correlationId: context.correlationId, outcome: "SUCCESS", origin: "support-validation", metadata: { resolutionAttempts: ticket.resolutionAttempts, answers: input.answers } } });
      });
      revalidate();
      return NextResponse.json({ data: { id, status: nextStatus }, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}

function revalidate() {
  revalidatePath("/support");
  revalidatePath("/admin/support");
}
