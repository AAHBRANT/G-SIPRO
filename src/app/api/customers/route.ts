import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";

const createSchema = z.object({
  name: z.string().trim().min(2).max(200),
});

/** Busca para o combobox de cliente/órgão da tela de oportunidade. */
export async function GET(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      await requirePermission("opportunities.update");
      const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
      const data = query.length < 2
        ? []
        : await getDatabase().customer.findMany({
            where: { active: true, name: { contains: query, mode: "insensitive" } },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
            take: 15,
          });
      return NextResponse.json({ data, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}

/**
 * Encontra por nome (exato, sem caixa) ou cria. Idempotente pelo mesmo motivo
 * do endpoint irmão de órgãos (`/api/contracting-authorities`): evita
 * duplicar o cadastro mestre em clique duplo ou nova tentativa após erro.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("opportunities.update");
      const { name } = createSchema.parse(await request.json());
      const database = getDatabase();
      const existing = await database.customer.findFirst({
        where: { name: { equals: name, mode: "insensitive" }, active: true },
        select: { id: true, name: true },
      });
      const customer = existing ?? await database.customer.create({
        data: { name, createdBy: authorization.actorId, updatedBy: authorization.actorId },
        select: { id: true, name: true },
      });
      return NextResponse.json({ data: customer, correlationId: context.correlationId }, { status: existing ? 200 : 201 });
    } catch (error) {
      return toApiError(error);
    }
  });
}
