import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { storeDocumentFile } from "@/core/storage/document-storage";
import { TenderService } from "@/modules/tenders/application/tender-service";
import { PrismaTenderRepository } from "@/modules/tenders/infrastructure/prisma-tender-repository";
import { mapTenderApiError } from "@/modules/tenders/presentation/tender-api";

const filtersSchema = z.object({ query: z.string().trim().max(100).optional(), opportunityId: z.uuid().optional() });

export async function GET(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      await requirePermission("tenders.read");
      const url = new URL(request.url);
      const filters = filtersSchema.parse({ query: url.searchParams.get("query") || undefined, opportunityId: url.searchParams.get("opportunityId") || undefined });
      const data = await getDatabase().tender.findMany({
        where: {
          ...(filters.opportunityId && { opportunityId: filters.opportunityId }),
          ...(filters.query && { OR: [{ code: { contains: filters.query, mode: "insensitive" } }, { number: { contains: filters.query, mode: "insensitive" } }, { subject: { contains: filters.query, mode: "insensitive" } }] }),
        },
        include: { contractingAuthority: true, opportunity: true, lots: true, versions: { orderBy: { version: "desc" }, take: 1 } },
        orderBy: { createdAt: "desc" }, take: 100,
      });
      return NextResponse.json({ data, correlationId: context.correlationId });
    } catch (error) { return toApiError(error); }
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("tenders.create");
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("Arquivo original do edital é obrigatório.");
      const stored = await storeDocumentFile(file);
      const result = await new TenderService(new PrismaTenderRepository()).create({
        tender: JSON.parse(z.string().parse(form.get("tender"))),
        version: { ...stored, source: z.string().trim().min(1).max(500).parse(form.get("source")), receivedAt: new Date(), attachments: [] },
      }, authorization.actorId, context.correlationId);
      return NextResponse.json({ data: result, correlationId: context.correlationId }, { status: 201 });
    } catch (error) {
      try { mapTenderApiError(error); } catch (mapped) { return toApiError(mapped); }
    }
  });
}
