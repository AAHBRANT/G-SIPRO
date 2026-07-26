import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { ValidationError } from "@/core/errors/application-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { OpportunityAnalysisService } from "@/modules/opportunity-intelligence/application/opportunity-analysis-service";
import { ClimateStudyService } from "@/modules/opportunity-intelligence/application/climate-study-service";
import { PrismaOpportunityAnalysisRepository } from "@/modules/opportunity-intelligence/infrastructure/prisma-opportunity-analysis-repository";
import { OpenMeteoClimateApi } from "@/modules/opportunity-intelligence/infrastructure/open-meteo-climate-api";
import { mapOpportunityAnalysisApiError } from "@/modules/opportunity-intelligence/presentation/opportunity-analysis-api";
import { climateStudyContextSchema } from "@/modules/opportunity-intelligence/domain/climate-study";
import { routeDestinationSchema } from "@/modules/opportunity-intelligence/domain/route-study";
import { RouteStudyService } from "@/modules/opportunity-intelligence/application/route-study-service";
import { AzureMapsRoutesApi } from "@/modules/opportunity-intelligence/infrastructure/azure-maps-routes-api";
import { PrismaRouteStudyRepository } from "@/modules/opportunity-intelligence/infrastructure/prisma-route-study-repository";
import { FinancialAnalysisService } from "@/modules/opportunity-intelligence/application/financial-analysis-service";
import { PrismaFinancialAnalysisRepository } from "@/modules/opportunity-intelligence/infrastructure/prisma-financial-analysis-repository";

const idempotencyKeySchema = z.string().trim().min(8).max(160);
const commandSchema = z.object({
  stage: z.enum(["COMMERCIAL", "TECHNICAL", "CLIMATE", "LOGISTICS", "FINANCIAL"]).default("COMMERCIAL"),
  climateContext: climateStudyContextSchema.optional(),
  routeDestination: routeDestinationSchema.optional(),
  routeBaseId: z.uuid().optional(),
}).strict().superRefine((value, context) => {
  if (value.stage === "CLIMATE" && !value.climateContext) {
    context.addIssue({
      code: "custom",
      path: ["climateContext"],
      message: "Localização e período da obra são obrigatórios para consultar a API climática.",
    });
  }
  if (value.stage === "LOGISTICS" && !value.routeDestination) {
    context.addIssue({
      code: "custom",
      path: ["routeDestination"],
      message: "O destino da obra é obrigatório para consultar as rotas.",
    });
  }
  if (value.stage === "LOGISTICS" && !value.routeBaseId) {
    context.addIssue({
      code: "custom",
      path: ["routeBaseId"],
      message: "Selecione a base operacional que será o endereço de partida.",
    });
  }
});

export async function POST(request: Request, route: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("analytics.calculate");
      const idempotencyKey = request.headers.get("idempotency-key");
      if (!idempotencyKey) throw new ValidationError("Informe o cabeçalho Idempotency-Key.");
      idempotencyKeySchema.parse(idempotencyKey);

      const opportunityId = z.uuid().parse((await route.params).id);
      const command = commandSchema.parse(await request.json().catch(() => ({})));
      const repository = new PrismaOpportunityAnalysisRepository();
      let data: unknown;
      if (command.stage === "CLIMATE") {
        data = await new ClimateStudyService(repository, new OpenMeteoClimateApi()).run(
          opportunityId,
          command.climateContext,
          authorization.actorId,
          context.correlationId,
        );
      } else if (command.stage === "LOGISTICS") {
        data = await new RouteStudyService(new PrismaRouteStudyRepository(), new AzureMapsRoutesApi()).run(
          opportunityId,
          command.routeDestination,
          command.routeBaseId!,
          authorization.actorId,
          context.correlationId,
        );
      } else if (command.stage === "FINANCIAL") {
        data = await new FinancialAnalysisService(new PrismaFinancialAnalysisRepository()).run(
          opportunityId,
          authorization.actorId,
          context.correlationId,
        );
      } else {
        const service = new OpportunityAnalysisService(repository);
        data = command.stage === "TECHNICAL"
          ? await service.runTechnicalCapacity(opportunityId, authorization.actorId, context.correlationId)
          : await service.runCommercialPreliminary(opportunityId, authorization.actorId, context.correlationId);
      }
      return NextResponse.json({ data, correlationId: context.correlationId }, { status: 201 });
    } catch (error) {
      try {
        mapOpportunityAnalysisApiError(error);
      } catch (mapped) {
        return toApiError(mapped);
      }
    }
  });
}
