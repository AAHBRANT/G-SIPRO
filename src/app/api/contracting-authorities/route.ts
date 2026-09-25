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
        : await getDatabase().contractingAuthority.findMany({
            where: { active: true, name: { contains: query, mode: "insensitive" } },
            select: { id: true, name: true, sphere: true, locality: true },
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
 * Encontra por nome (exato, sem caixa) ou cria. Idempotente de propósito: a
 * tela de oportunidade chama isto ao vincular um órgão digitado à mão, e
 * clicar duas vezes (ou repetir após erro de rede) não pode duplicar o
 * cadastro mestre — mesma regra de "nunca duplicar órgão" que já valia para
 * o vínculo automático da varredura (ver OpportunityFromScoutedTender).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("opportunities.update");
      const { name } = createSchema.parse(await request.json());
      const database = getDatabase();
      const existing = await database.contractingAuthority.findFirst({
        where: { name: { equals: name, mode: "insensitive" }, active: true },
        select: { id: true, name: true, sphere: true, locality: true },
      });
      // `identifiers.revisarCadastro` segue o mesmo marcador que o cadastro
      // automático do "aprovar" já usa (ver OpportunityFromScoutedTender):
      // quem é criado fora da curadoria da equipe nasce sinalizado para
      // conferência, venha do PNCP ou de alguém digitando aqui.
      const authority = existing ?? await database.contractingAuthority.create({
        data: {
          name,
          identifiers: { origem: "MANUAL", revisarCadastro: true },
          createdBy: authorization.actorId,
          updatedBy: authorization.actorId,
        },
        select: { id: true, name: true, sphere: true, locality: true },
      });
      return NextResponse.json({ data: authority, correlationId: context.correlationId }, { status: existing ? 200 : 201 });
    } catch (error) {
      return toApiError(error);
    }
  });
}
