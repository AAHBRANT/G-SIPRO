import { after, NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/core/authorization/authorization-context";
import { ConflictError, ResourceNotFoundError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import {
  ScoutedTenderAlreadyDecidedError,
  ScoutedTenderNotFoundError,
  TriageService,
  discardReasonSchema,
} from "@/modules/scouting/application/triage-service";
import { montarLicitacaoDaAprovacao } from "@/modules/scouting/application/licitacao-da-aprovacao-service";
import { OpportunityFromScoutedTender, PrismaTriageRepository } from "@/modules/scouting/infrastructure/prisma-scouting-repository";

const commandSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVE") }).strict(),
  z.object({ decision: z.literal("DISCARD"), reason: discardReasonSchema }).strict(),
]);

/**
 * Registra a triagem humana de uma licitação rastreada. Aprovar cria a
 * oportunidade no G-SIPRO; descartar preserva o registro com autor e motivo.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      // Aprovar cria uma oportunidade: exige a mesma alçada do cadastro manual.
      const authorization = await requirePermission("opportunities.create");
      const { id } = await params;
      const command = commandSchema.parse(await request.json());
      const service = new TriageService(new PrismaTriageRepository(), new OpportunityFromScoutedTender());

      if (command.decision === "APPROVE") {
        const opportunityId = await service.approve(id, authorization.actorId, context.correlationId);
        /**
         * A ficha da LICITAÇÃO é montada depois de responder: ela depende de
         * baixar do PNCP tudo que o órgão publicou (10 a 20 MB é comum) só
         * para pesar e conferir cada arquivo, e segurar a tela por isso seria
         * cobrar do usuário uma espera que ele não pediu — decisão do dono em
         * 22/09/2026. Falhar lá NÃO desfaz a aprovação: a oportunidade já
         * existe, e o serviço registra o motivo em vez de propagar erro para
         * uma requisição encerrada.
         */
        after(() => montarLicitacaoDaAprovacao(id, opportunityId, authorization.actorId, context.correlationId));
        return NextResponse.json({ data: { decision: "APPROVE", opportunityId }, correlationId: context.correlationId });
      }

      await service.discard(id, authorization.actorId, command.reason);
      return NextResponse.json({ data: { decision: "DISCARD" }, correlationId: context.correlationId });
    } catch (error) {
      if (error instanceof ScoutedTenderNotFoundError) return toApiError(new ResourceNotFoundError(error.message));
      if (error instanceof ScoutedTenderAlreadyDecidedError) return toApiError(new ConflictError(error.message));
      return toApiError(error);
    }
  });
}
