import { Prisma } from "@/generated/prisma/client";
import { ConflictError, ResourceNotFoundError, ValidationError } from "@/core/errors/application-error";
import { AnalysisNotFoundError, AnalysisRuleError } from "@/modules/analyses/application/analysis-service";
import { AnalysisConcurrencyError } from "@/modules/analyses/infrastructure/prisma-analysis-repository";

export function mapAnalysisApiError(error: unknown): never {
  if (error instanceof AnalysisNotFoundError) throw new ResourceNotFoundError(error.message);
  if (error instanceof AnalysisRuleError) throw new ValidationError(error.message);
  if (error instanceof AnalysisConcurrencyError) throw new ConflictError(error.message);
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictError("A competência já foi distribuída para este requisito.");
  throw error;
}
