import { randomUUID } from "node:crypto";
import { NextResponse, after } from "next/server";
import { z } from "zod";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { getEnvironment } from "@/core/config/env";
import { getDatabase } from "@/core/database/prisma";
import { AuthorizationError, ValidationError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createLogger } from "@/core/observability/logger";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { storeDocumentFile } from "@/core/storage/document-storage";
import { supportTicketInputSchema } from "@/modules/support/domain/support-ticket";
import { SupportTriageService } from "@/modules/support/application/support-triage-service";

const allowedAttachments = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain"]);
const triageLogger = createLogger(getEnvironment());

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

      // A triagem NÃO bloqueia a resposta: o modelo local pode levar minutos e
      // o usuário não deve esperar por isso. O chamado nasce em OPEN e o
      // diagnóstico chega em seguida. Se este processo morrer antes de
      // concluir, a rota de dispatch reprocessa (ver SupportTriageService).
      after(async () => {
        try {
          await new SupportTriageService().triageTicket(ticketId, context.correlationId);
        } catch (error) {
          triageLogger.error({
            ticketId,
            correlationId: context.correlationId,
            errorMessage: error instanceof Error ? error.message : String(error),
          }, "Falha na triagem assistida em segundo plano.");
        }
      });

      return NextResponse.json({ data: { id: ticketId, status: "OPEN", approvalRequired: false }, correlationId: context.correlationId }, { status: 201 });
    } catch (error) { return toApiError(error); }
  });
}
