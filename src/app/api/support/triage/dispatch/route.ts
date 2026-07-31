import { NextResponse } from "next/server";
import { z } from "zod";

import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { SupportTriageService } from "@/modules/support/application/support-triage-service";
import { requireSupportExecutor } from "@/modules/support/infrastructure/support-executor-auth";

const commandSchema = z.object({ limit: z.number().int().min(1).max(25).default(10) }).strict();

/**
 * Rede de segurança da triagem assistida.
 *
 * O caminho normal é o `after()` na criação do chamado. Esta rota existe para o
 * caso de aquele trabalho não concluir — reinício do contêiner, queda da
 * inteligência, implantação no meio do processamento. Reprocessa chamados que
 * seguem em OPEN sem diagnóstico.
 *
 * Reaproveita a credencial do executor de suporte (OIDC do GitHub Actions ou
 * token compartilhado), a mesma já usada por /api/support/agent/queue.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      await requireSupportExecutor(request);
      const command = commandSchema.parse(await request.json().catch(() => ({})));
      const data = await new SupportTriageService().dispatchPending(command.limit);
      return NextResponse.json({ data, count: data.length, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
