import {
  ApplicationError,
  ConflictError,
  ResourceNotFoundError,
  ValidationError,
} from "@/core/errors/application-error";
import { Prisma } from "@/generated/prisma/client";
import { ClimateApiUnavailableError } from "../application/climate-api";
import { RouteApiUnavailableError } from "../application/route-api";
import { RouteStudyRuleError } from "../application/route-study-service";
import {
  OpportunityAnalysisNotFoundError,
  OpportunityAnalysisRuleError,
} from "../infrastructure/prisma-opportunity-analysis-repository";

export function mapOpportunityAnalysisApiError(error: unknown): never {
  if (error instanceof OpportunityAnalysisNotFoundError) throw new ResourceNotFoundError(error.message);
  if (error instanceof OpportunityAnalysisRuleError) throw new ValidationError(error.message);
  if (error instanceof ClimateApiUnavailableError) {
    throw new ApplicationError(
      "A API climática está indisponível. Nenhuma nota foi atribuída.",
      "CLIMATE_API_UNAVAILABLE",
      503,
    );
  }
  if (error instanceof RouteStudyRuleError) throw new ValidationError(error.message);
  if (error instanceof RouteApiUnavailableError) {
    throw new ApplicationError(
      "A API de rotas está indisponível. Nenhuma distância ou custo foi presumido.",
      "ROUTE_API_UNAVAILABLE",
      503,
    );
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ConflictError("Esta versão da análise já foi registrada.");
  }
  throw error;
}
