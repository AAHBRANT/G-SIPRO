/**
 * ⚠️ De propósito, esta rota nunca teve (e não deve voltar a ter) um POST que
 * DISPARA leitura de edital, manual nem de releitura forçada. Instrução
 * direta e repetida do usuário, contra um botão "Reler edital" que chegou a
 * existir aqui (removido 22/09/2026): "não é pra ter botão... é você que tem
 * de olhar o que é exigido no edital". A leitura é sempre automática, pela
 * varredura/represado (`process-backlog`) — nunca por ação de tela.
 */
import { NextResponse } from "next/server";

import { requirePermission } from "@/core/authorization/authorization-context";
import { ResourceNotFoundError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { PrismaEditalReadingRepository } from "@/modules/scouting/infrastructure/prisma-edital-reading";

/**
 * Registra que uma pessoa conferiu a leitura contra o PDF.
 *
 * É o que tira a ressalva da tela. A alçada é a mesma de decidir sobre a fila
 * (`opportunities.create`, como na rota de decisão), e não a de executar IA:
 * quem carimba "conferido" está assumindo a leitura, e é disso que a equipe
 * depende para montar proposta.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("opportunities.create");
      const { id } = await params;
      const reading = await new PrismaEditalReadingRepository().markReviewed(id, authorization.actorId, context.correlationId);
      if (!reading) return toApiError(new ResourceNotFoundError("Esta licitação ainda não teve o edital lido."));
      return NextResponse.json({ data: reading, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
