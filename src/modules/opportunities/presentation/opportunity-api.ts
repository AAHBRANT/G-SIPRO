import { Prisma } from "@/generated/prisma/client";
import { ConflictError, ResourceNotFoundError, ValidationError } from "@/core/errors/application-error";
import { OpportunityNotFoundError } from "@/modules/opportunities/application/opportunity-service";
import { OpportunityRuleError } from "@/modules/opportunities/domain/opportunity";
import { OpportunityConcurrencyError } from "@/modules/opportunities/infrastructure/prisma-opportunity-repository";

export function mapOpportunityApiError(error: unknown): never {
  if (error instanceof OpportunityRuleError) {
    throw new ValidationError(error.message, { fields: error.fields });
  }
  if (error instanceof OpportunityNotFoundError) {
    throw new ResourceNotFoundError(error.message);
  }
  if (error instanceof OpportunityConcurrencyError) {
    throw new ConflictError(error.message);
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ConflictError("Já existe uma oportunidade com o código informado.", { fields: ["code"] });
  }
  throw error;
}
