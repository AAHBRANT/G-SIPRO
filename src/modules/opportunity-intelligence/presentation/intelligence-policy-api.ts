import { ConflictError, ResourceNotFoundError, ValidationError } from "@/core/errors/application-error";
import { Prisma } from "@/generated/prisma/client";
import {
  IntelligencePolicyNotFoundError,
  IntelligencePolicyRuleError,
} from "../infrastructure/prisma-intelligence-policy-repository";

export function mapIntelligencePolicyApiError(error: unknown): never {
  if (error instanceof IntelligencePolicyNotFoundError) throw new ResourceNotFoundError(error.message);
  if (error instanceof IntelligencePolicyRuleError) throw new ValidationError(error.message);
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ConflictError("Política, versão ou aprovação já registrada.");
  }
  throw error;
}
