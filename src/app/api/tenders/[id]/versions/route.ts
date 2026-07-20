import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { storeDocumentFile } from "@/core/storage/document-storage";
import { TenderService } from "@/modules/tenders/application/tender-service";
import { PrismaTenderRepository } from "@/modules/tenders/infrastructure/prisma-tender-repository";
import { mapTenderApiError } from "@/modules/tenders/presentation/tender-api";

export async function POST(request: Request, route: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("tenders.version");
      const id = z.uuid().parse((await route.params).id);
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("Arquivo original da versão é obrigatório.");
      const stored = await storeDocumentFile(file);
      const result = await new TenderService(new PrismaTenderRepository()).addVersion(id, {
        ...stored, source: z.string().trim().min(1).max(500).parse(form.get("source")), receivedAt: new Date(), attachments: [],
      }, authorization.actorId, context.correlationId);
      return NextResponse.json({ data: result, correlationId: context.correlationId }, { status: 201 });
    } catch (error) {
      try { mapTenderApiError(error); } catch (mapped) { return toApiError(mapped); }
    }
  });
}
