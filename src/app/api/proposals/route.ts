import { NextResponse } from "next/server";
import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { ProposalService } from "@/modules/proposals/application/proposal-service";
import { PrismaProposalRepository } from "@/modules/proposals/infrastructure/prisma-proposal-repository";
import { mapProposalApiError } from "@/modules/proposals/presentation/proposal-api";

export async function GET(request: Request) { const context=createRequestContext({correlationId:request.headers.get("x-correlation-id")??undefined}); return runWithRequestContext(context,async()=>{try{const authorization=await requirePermission("proposals.read");const data=await new ProposalService(new PrismaProposalRepository()).list(authorization.actorId,context.correlationId);return NextResponse.json({data,correlationId:context.correlationId});}catch(error){return toApiError(error);}}); }
export async function POST(request: Request) { const context=createRequestContext({correlationId:request.headers.get("x-correlation-id")??undefined}); return runWithRequestContext(context,async()=>{try{const authorization=await requirePermission("proposals.create");const data=await new ProposalService(new PrismaProposalRepository()).create(await request.json(),authorization.actorId,context.correlationId);return NextResponse.json({data,correlationId:context.correlationId},{status:201});}catch(error){try{mapProposalApiError(error);}catch(mapped){return toApiError(mapped);}}}); }

