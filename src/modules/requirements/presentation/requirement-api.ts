import { Prisma } from "@/generated/prisma/client";
import { ConflictError, ResourceNotFoundError, ValidationError } from "@/core/errors/application-error";
import { RequirementNotFoundError } from "@/modules/requirements/application/requirement-service";
import { RequirementConcurrencyError, RequirementValidationBlockedError } from "@/modules/requirements/infrastructure/prisma-requirement-repository";

export function mapRequirementApiError(error: unknown): never {
  if (error instanceof RequirementNotFoundError) throw new ResourceNotFoundError(error.message);
  if (error instanceof RequirementValidationBlockedError) throw new ValidationError(error.message);
  if (error instanceof RequirementConcurrencyError) throw new ConflictError(error.message);
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictError("Requisito ou versão de histórico já existente.");
  throw error;
}

