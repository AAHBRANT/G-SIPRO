import { Prisma } from "@/generated/prisma/client";
import { ConflictError, ResourceNotFoundError, ValidationError } from "@/core/errors/application-error";
import { MatrixRequirementsBlockedError, MatrixSourceNotFoundError } from "@/modules/compliance-matrices/infrastructure/prisma-matrix-repository";

export function mapMatrixApiError(error: unknown): never {
  if (error instanceof MatrixSourceNotFoundError) throw new ResourceNotFoundError(error.message);
  if (error instanceof MatrixRequirementsBlockedError) throw new ValidationError(error.message);
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictError("Já existe uma matriz inicial com essa referência para a versão do edital.");
  throw error;
}

