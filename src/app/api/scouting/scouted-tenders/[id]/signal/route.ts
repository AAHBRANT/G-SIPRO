import { NextResponse } from "next/server";

import { requirePermission } from "@/core/authorization/authorization-context";
import { ConflictError, ResourceNotFoundError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import {
  SignalNotFoundError,
  SignalService,
  TenderAlreadyDecidedError,
  TenderNotFoundError,
} from "@/modules/scouting/application/signal-service";
import { signalCommandSchema } from "@/modules/scouting/domain/signal";
import { PrismaSignalRepository } from "@/modules/scouting/infrastructure/prisma-scouting-repository";

const service = () => new SignalService(new PrismaSignalRepository());

/**
 * Finca ou substitui a sinalização de uma licitação rastreada.
 *
 * A alçada é a de leitura da fila, não a de decidir: sinalizar orienta a
 * equipe, não aprova nem descarta nada. Quem enxerga a fila pode marcá-la.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("opportunities.read");
      const { id } = await params;
      const command = signalCommandSchema.parse(await request.json());
      const signal = await service().signal(id, command, authorization.actorId);
      return NextResponse.json({ data: signal, correlationId: context.correlationId });
    } catch (error) {
      if (error instanceof TenderNotFoundError) return toApiError(new ResourceNotFoundError(error.message));
      if (error instanceof TenderAlreadyDecidedError) return toApiError(new ConflictError(error.message));
      return toApiError(error);
    }
  });
}

/** Tira a sinalização. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      await requirePermission("opportunities.read");
      const { id } = await params;
      await service().unsignal(id);
      return NextResponse.json({ data: { removed: true }, correlationId: context.correlationId });
    } catch (error) {
      if (error instanceof SignalNotFoundError) return toApiError(new ResourceNotFoundError(error.message));
      return toApiError(error);
    }
  });
}
