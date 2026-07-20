import { ConflictError, ResourceNotFoundError } from "@/core/errors/application-error";
import { MatrixExportIntegrityError, MatrixExportNotFoundError, MatrixFinalizationRuleError } from "@/modules/compliance-matrices/infrastructure/prisma-matrix-export-repository";

export function mapMatrixExportApiError(error: unknown): never {
  if (error instanceof MatrixExportNotFoundError) throw new ResourceNotFoundError(error.message);
  if (error instanceof MatrixFinalizationRuleError || error instanceof MatrixExportIntegrityError) throw new ConflictError(error.message);
  throw error;
}

