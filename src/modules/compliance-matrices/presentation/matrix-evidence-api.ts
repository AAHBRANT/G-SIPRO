import { Prisma } from "@/generated/prisma/client";
import { ConflictError, ResourceNotFoundError, ValidationError } from "@/core/errors/application-error";
import { MatrixEvidenceNotFoundError, MatrixEvidenceRuleError, MatrixItemNotFoundError, MatrixQuantityNotFoundError } from "@/modules/compliance-matrices/infrastructure/prisma-matrix-evidence-repository";

export function mapMatrixEvidenceApiError(error: unknown): never {
  if (error instanceof MatrixItemNotFoundError || error instanceof MatrixEvidenceNotFoundError || error instanceof MatrixQuantityNotFoundError) throw new ResourceNotFoundError(error.message);
  if (error instanceof MatrixEvidenceRuleError) throw new ValidationError(error.message);
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictError("Essa evidência ou comparação já está associada ao item.");
  throw error;
}

