import { NextResponse } from "next/server";
import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import {
  createRequestContext,
  runWithRequestContext,
} from "@/core/observability/request-context";
import { ProposalTenderLinkService } from "@/modules/proposal-tender-link/application/proposal-tender-link-service";
import {
  PrismaProposalTenderLinkRepository,
  ProposalTenderLinkNotFoundError,
  ProposalTenderLinkRuleError,
} from "@/modules/proposal-tender-link/infrastructure/prisma-proposal-tender-link-repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = createRequestContext({
    correlationId: request.headers.get("x-correlation-id") ?? undefined,
  });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("proposals.create");
      const data = await new ProposalTenderLinkService(
        new PrismaProposalTenderLinkRepository(),
      ).promote(
        (await params).id,
        await request.json(),
        authorization.actorId,
        context.correlationId,
      );
      return NextResponse.json(
        {
          data: {
            ...data,
            tenderUrl: `/tenders/${data.tenderId}`,
            matrixUrl: "/compliance-matrices",
          },
          correlationId: context.correlationId,
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof ProposalTenderLinkNotFoundError) {
        return NextResponse.json({ error: { message: error.message } }, { status: 404 });
      }
      if (error instanceof ProposalTenderLinkRuleError) {
        return NextResponse.json({ error: { message: error.message } }, { status: 409 });
      }
      return toApiError(error);
    }
  });
}
