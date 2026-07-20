import { Prisma } from "@/generated/prisma/client";
import { ConflictError, ResourceNotFoundError, ValidationError } from "@/core/errors/application-error";
import { AssessmentItemNotFoundError, AssessmentResponsibleNotFoundError, AssessmentRuleError } from "@/modules/compliance-matrices/infrastructure/prisma-item-assessment-repository";

export function mapItemAssessmentApiError(error: unknown): never {
  if (error instanceof AssessmentItemNotFoundError || error instanceof AssessmentResponsibleNotFoundError) throw new ResourceNotFoundError(error.message);
  if (error instanceof AssessmentRuleError) throw new ValidationError(error.message);
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictError("A versão dessa validação já existe.");
  throw error;
}

