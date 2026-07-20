import { Prisma } from "@/generated/prisma/client";
import { ConflictError, ResourceNotFoundError, ValidationError } from "@/core/errors/application-error";

export function mapTechnicalEvidenceApiError(error: unknown): never {
  if (error instanceof Error && error.message === "INVALID_TECHNICAL_EVIDENCE_VERSION_CHAIN") throw new ValidationError("A versão anterior deve pertencer ao mesmo documento técnico e à mesma experiência.");
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictError("Número e versão do documento técnico já cadastrados.");
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") throw new ResourceNotFoundError("Experiência, versão documental, CAT ou versão anterior não encontrada.");
  throw error;
}
