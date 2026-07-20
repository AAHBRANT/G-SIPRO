import { Prisma } from "@/generated/prisma/client";
import { ConflictError, ResourceNotFoundError, ValidationError } from "@/core/errors/application-error";

export function mapProfessionalApiError(error: unknown): never {
  if (error instanceof Error && error.message === "INVALID_PROFESSIONAL_EVIDENCE_TARGET") throw new ValidationError("O vínculo documental do profissional aceita CAT ou ART, não atestado.");
  if (error instanceof Error && error.message === "PROFESSIONAL_LINK_DOCUMENT_MISMATCH") throw new ValidationError("A versão documental deve ser a mesma vinculada à CAT ou ART.");
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictError("Profissional ou vínculo técnico já cadastrado.");
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") throw new ResourceNotFoundError("Contrato, obra, CAT, ART ou versão documental não encontrada.");
  throw error;
}
