import { NextResponse } from "next/server";
import { z } from "zod";

import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { ScoutService } from "@/modules/scouting/application/scout-service";
import { PncpClient } from "@/modules/scouting/infrastructure/pncp-client";
import { PrismaScoutRepository } from "@/modules/scouting/infrastructure/prisma-scouting-repository";
import { requireScoutDispatcher } from "@/modules/scouting/infrastructure/scout-dispatch-auth";

const commandSchema = z.object({
  trigger: z.enum(["SCHEDULED", "MANUAL"]).default("SCHEDULED"),
  /**
   * Recorte opcional de unidades federativas. Permite ao agendador varrer o país
   * em lotes, mantendo cada requisição curta o bastante para não ser encerrada
   * pelo balanceador. Sem recorte, valem os estados configurados nos filtros.
   */
  states: z.array(z.string().trim().toUpperCase().length(2)).max(27).optional(),
}).strict();

/**
 * Janela consultada: certames que encerram nos próximos 12 meses. Horizontes
 * mais largos alargam demais o resultado e fazem o portal estourar o tempo
 * limite — comportamento verificado contra o serviço real.
 */
const HORIZON_MONTHS = 12;

/**
 * Dispara a varredura semanal do Buscador. Chamada pelo agendador (domingo),
 * autenticada por token dedicado — não por sessão de usuário.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      requireScoutDispatcher(request);
      const command = commandSchema.parse(await request.json().catch(() => ({})));

      const repository = new PrismaScoutRepository();
      const filter = await repository.loadFilter();
      const finalDate = new Date();
      finalDate.setMonth(finalDate.getMonth() + HORIZON_MONTHS);

      // O lote pedido pelo agendador é cruzado com os estados configurados pela
      // equipe: se ela restringiu a atuação, nenhum estado fora disso chega a
      // ser consultado. Sem restrição, o lote vale integralmente.
      const configured = filter?.states ?? [];
      const requested = command.states;
      const states = requested && configured.length > 0
        ? requested.filter((state) => configured.includes(state))
        : requested ?? configured;

      // Lote inteiramente fora da área de atuação: nada a consultar.
      if (requested && configured.length > 0 && states.length === 0) {
        return NextResponse.json({ data: { skipped: true, reason: "Lote fora dos estados configurados." }, correlationId: context.correlationId });
      }

      const source = new PncpClient({ finalDate, states });
      const data = await new ScoutService(repository, source).run(command.trigger);

      return NextResponse.json({ data, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
