import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { AuthorizationError, ValidationError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { storeDocumentFile } from "@/core/storage/document-storage";
import { supportTicketInputSchema, type SupportDiagnosis, type SupportTicketInput } from "@/modules/support/domain/support-ticket";
import { supportApprovalPolicy } from "@/modules/support/domain/support-triage-policy";
import { OpenAiSupportProvider } from "@/modules/support/infrastructure/openai-support-provider";

const allowedAttachments = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain"]);

function fallbackDiagnosis(input: SupportTicketInput): SupportDiagnosis {
  const feature = input.type === "NEW_FEATURE" || input.type === "IMPROVEMENT";
  return {
    summary: "Solicitação registrada e aguardando aprofundamento técnico.",
    probableCause: input.type === "BUG" ? "A causa será confirmada com os registros técnicos e a reprodução do comportamento." : "Não se aplica até a avaliação funcional.",
    severity: input.priority === "CRITICAL" ? "CRITICAL" : input.priority === "HIGH" ? "HIGH" : "MEDIUM",
    changeClass: input.type === "NEW_FEATURE" ? "NEW_TOOL" : feature ? "FUNCTIONAL_CHANGE" : "CORRECTION",
    requiredActor: "AI",
    ownerActionCategory: null,
    requiredAction: null,
    securityGuidance: null,
    recommendedAction: feature ? "Avaliar escopo, impacto e critérios de aceite antes da execução." : "Reproduzir, corrigir a causa mínima e executar testes de regressão.",
    suggestedTests: ["Reproduzir o cenário informado", "Validar o fluxo corrigido", "Executar testes de regressão relacionados"],
    userGuidance: "Acompanhe este chamado; as próximas atualizações serão registradas aqui.",
    confidence: 0.35,
  };
}

export async function GET(request: Request) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await getCurrentAuthorizationContext();
      if (!authorization) throw new AuthorizationError("Autenticação corporativa obrigatória.");
      const data = await getDatabase().supportTicket.findMany({
        where: authorization.isMaster ? undefined : { reporterId: authorization.actorId },
        include: { reporter: { select: { displayName: true, email: true } }, attachments: true, decisions: { include: { decidedBy: { select: { displayName: true } } }, orderBy: { decidedAt: "desc" } }, updates: { include: { createdBy: { select: { displayName: true } } }, orderBy: { createdAt: "desc" } } },
        orderBy: { createdAt: "desc" }, take: 200,
      });
      return NextResponse.json({ data: data.map(ticket => ({ ...ticket, attachments: ticket.attachments.map(file => ({ ...file, sizeBytes: file.sizeBytes.toString() })) })), correlationId: context.correlationId });
    } catch (error) { return toApiError(error); }
  });
}

export async function POST(request: Request) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await getCurrentAuthorizationContext();
      if (!authorization) throw new AuthorizationError("Autenticação corporativa obrigatória.");
      const form = await request.formData();
      let clientContext: Record<string, string> | undefined;
      const rawContext = form.get("clientContext");
      if (typeof rawContext === "string" && rawContext) clientContext = z.record(z.string(), z.string().max(1_000)).parse(JSON.parse(rawContext));
      const input = supportTicketInputSchema.parse({ type: form.get("type"), priority: form.get("priority"), title: form.get("title"), description: form.get("description"), pagePath: form.get("pagePath") || undefined, errorMessage: form.get("errorMessage") || undefined, stepsToReproduce: form.get("stepsToReproduce") || undefined, clientContext });
      const file = form.get("file");
      const stored = file instanceof File && file.size > 0 ? await (async () => {
        if (!allowedAttachments.has(file.type)) throw new ValidationError("Anexe uma imagem, PDF ou arquivo de texto.");
        return storeDocumentFile(file);
      })() : undefined;
      const ticketId = randomUUID();
      const database = getDatabase();
      await database.$transaction(async transaction => {
        await transaction.supportTicket.create({ data: { id: ticketId, ...input, clientContext: input.clientContext, reporterId: authorization.actorId, correlationId: context.correlationId } });
        if (stored) await transaction.supportTicketAttachment.create({ data: { id: randomUUID(), ticketId, fileName: stored.fileName, fileHash: stored.fileHash, mimeType: stored.mimeType, sizeBytes: stored.sizeBytes, uri: stored.uri, createdBy: authorization.actorId } });
        await transaction.supportTicketUpdate.create({ data: { id: randomUUID(), ticketId, toStatus: "OPEN", note: "Chamado registrado pelo usuário.", createdById: authorization.actorId } });
        await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId: authorization.actorId, action: "SUPPORT_TICKET_CREATED", entityType: "SUPPORT_TICKET", entityId: ticketId, correlationId: context.correlationId, outcome: "SUCCESS", origin: "support-center", metadata: { type: input.type, priority: input.priority, attachment: Boolean(stored) } } });
      });

      const provider = new OpenAiSupportProvider();
      let diagnosis: SupportDiagnosis;
      let model: string | undefined;
      try { diagnosis = await provider.diagnose(input, context.correlationId); model = provider.modelName; } catch { diagnosis = fallbackDiagnosis(input); }
      const { approvalRequired, approvalReason, status, externalBlocker } = supportApprovalPolicy(input, diagnosis);
      await database.$transaction(async transaction => {
        const triagedAt = new Date();
        await transaction.supportTicket.update({ where: { id: ticketId }, data: { status, aiDiagnosis: diagnosis, aiProviderModel: model, aiDiagnosedAt: triagedAt, approvalRequired, approvalReason, priority: diagnosis.severity === "CRITICAL" ? "CRITICAL" : input.priority, externalBlocker: externalBlocker ? { ...externalBlocker, reportedAt: triagedAt.toISOString() } : undefined, ownerActionRequiredAt: externalBlocker ? triagedAt : undefined } });
        const triageNote = externalBlocker
          ? "A triagem identificou imediatamente uma ação exclusiva do proprietário. O chamado foi direcionado sem consumir tentativas automáticas."
          : model ? "Triagem assistida por inteligência concluída." : "Triagem inicial concluída; diagnóstico técnico detalhado ainda será realizado.";
        await transaction.supportTicketUpdate.create({ data: { id: randomUUID(), ticketId, fromStatus: "OPEN", toStatus: status, note: triageNote, createdById: authorization.actorId, actorLabel: externalBlocker ? "Triagem inteligente" : "Usuário" } });
        await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: model ? "APPLICATION" : "SYSTEM", actorId: model ? "openai-support-triage" : "support-fallback-triage", action: externalBlocker ? "SUPPORT_OWNER_ACTION_REQUIRED" : "SUPPORT_TICKET_TRIAGED", entityType: "SUPPORT_TICKET", entityId: ticketId, correlationId: context.correlationId, outcome: "SUCCESS", origin: "support-center", metadata: { approvalRequired, changeClass: diagnosis.changeClass, requiredActor: diagnosis.requiredActor, model: model ?? null } } });
      });
      return NextResponse.json({ data: { id: ticketId, status, approvalRequired }, correlationId: context.correlationId }, { status: 201 });
    } catch (error) { return toApiError(error); }
  });
}
