import { ConflictError, ResourceNotFoundError, ValidationError } from "@/core/errors/application-error";
import { Prisma } from "@/generated/prisma/client";
import { TechnicalSectionConflictError, TechnicalSectionNotFoundError, TechnicalSectionRuleError } from "@/modules/proposal-sections/infrastructure/prisma-technical-section-repository";

export function mapTechnicalSectionApiError(error: unknown): never {
  if (error instanceof TechnicalSectionNotFoundError) throw new ResourceNotFoundError(error.message);
  if (error instanceof TechnicalSectionRuleError) throw new ValidationError(error.message);
  if (error instanceof TechnicalSectionConflictError) throw new ConflictError(error.message);
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictError("Já existe uma seção nessa posição.", { fields: ["position"] });
  throw error;
}
