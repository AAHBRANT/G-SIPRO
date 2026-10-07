import { NextResponse } from "next/server";

import { requireMaster } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { aplicarLimpeza } from "@/modules/scouting/application/limpeza-de-duplicatas-service";

/**
 * Aplica a limpeza das duplicatas deixadas pela aprovação do Buscador. Só
 * usuário mestre, e só depois de ver a prévia em /admin/duplicatas. O plano é
 * recalculado aqui na hora, nunca recebido da tela.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requireMaster();
      const resultado = await aplicarLimpeza(authorization.actorId, context.correlationId);
      return NextResponse.json({ data: resultado, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
