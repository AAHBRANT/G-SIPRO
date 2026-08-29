import { NextResponse } from "next/server";

import { requirePermission } from "@/core/authorization/authorization-context";
import { ResourceNotFoundError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { EditalReadingService } from "@/modules/scouting/application/edital-reading-service";
import { PncpFilesClient } from "@/modules/scouting/infrastructure/pncp-files-client";
import {
  PrismaEditalArchive,
  PrismaEditalExtraction,
  PrismaEditalReadingRepository,
} from "@/modules/scouting/infrastructure/prisma-edital-reading";

const service = () => new EditalReadingService(
  new PncpFilesClient(),
  new PrismaEditalArchive(),
  new PrismaEditalExtraction(),
  new PrismaEditalReadingRepository(),
);

/**
 * Código HTTP por desfecho.
 *
 * Só o que é de fato erro sai como erro. "Sem arquivo publicado" e "anexo
 * grande demais" são respostas legítimas sobre a licitação, e a tela precisa
 * delas para dizer por que o pré-requisito segue pendente — devolvê-las como
 * 4xx faria o navegador tratá-las como falha e engolir o motivo.
 */
const httpStatus: Readonly<Record<string, number>> = {
  READ: 200,
  ALREADY_READ: 200,
  NO_IDENTIFIER: 200,
  NO_FILE: 200,
  FILE_TOO_LARGE: 200,
  NOTHING_EXTRACTED: 200,
  TENDER_NOT_FOUND: 404,
  // Falta caso de uso de IA aprovado para EDITAL: é configuração pendente da
  // governança, não defeito da licitação.
  NOT_CONFIGURED: 409,
  FAILED: 502,
};

/**
 * Lê o edital de uma licitação rastreada.
 *
 * Exige `ai.execute` — a mesma alçada do reconhecimento no acervo técnico:
 * a chamada é paga e grava arquivo no acervo documental. O caso de uso
 * aprovado ainda é conferido dentro do serviço de extração, contra as fontes
 * que a governança autorizou.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("ai.execute");
      const { id } = await params;
      const outcome = await service().read(id, authorization, context.correlationId);
      return NextResponse.json(
        { data: outcome, correlationId: context.correlationId },
        { status: httpStatus[outcome.status] ?? 200 },
      );
    } catch (error) {
      return toApiError(error);
    }
  });
}

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
      const reading = await new PrismaEditalReadingRepository().markReviewed(id, authorization.actorId);
      if (!reading) return toApiError(new ResourceNotFoundError("Esta licitação ainda não teve o edital lido."));
      return NextResponse.json({ data: reading, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
