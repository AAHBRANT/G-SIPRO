import { NextResponse } from "next/server";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { AuthorizationError, ResourceNotFoundError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { readDocumentFile } from "@/core/storage/document-storage";

export async function GET(request: Request, route: { params: Promise<{ id: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await getCurrentAuthorizationContext();
      if (!authorization) throw new AuthorizationError("Autenticação corporativa obrigatória.");
      const attachment = await getDatabase().supportTicketAttachment.findUnique({ where: { id: (await route.params).id }, include: { ticket: { select: { reporterId: true } } } });
      if (!attachment) throw new ResourceNotFoundError("Anexo não encontrado.");
      if (!authorization.isMaster && attachment.ticket.reporterId !== authorization.actorId) throw new AuthorizationError();
      const bytes = await readDocumentFile(attachment.fileHash);
      const safeName = attachment.fileName.replace(/["\r\n]/g, "_");
      return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": attachment.mimeType, "Content-Length": String(bytes.length), "Content-Disposition": `inline; filename="${safeName}"`, "Cache-Control": "private, no-store" } });
    } catch (error) { return toApiError(error); }
  });
}
