import { NextResponse } from "next/server";
import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { ProposalService } from "@/modules/proposals/application/proposal-service";
import { PrismaProposalRepository } from "@/modules/proposals/infrastructure/prisma-proposal-repository";
import { mapProposalApiError } from "@/modules/proposals/presentation/proposal-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("proposals.create-version");
      const { id } = await params;
      const data = await new ProposalService(new PrismaProposalRepository()).createVersion(id, await request.json(), authorization.actorId, context.correlationId);
      return NextResponse.json({ data, correlationId: context.correlationId }, { status: 201 });
    } catch (error) {
      try { mapProposalApiError(error); } catch (mapped) { return toApiError(mapped); }
    }
  });
}
