import { Prisma } from "@/generated/prisma/client";
import { ConflictError, ResourceNotFoundError } from "@/core/errors/application-error";
import { TenderNotFoundError } from "@/modules/tenders/infrastructure/prisma-tender-repository";

export function mapTenderApiError(error: unknown): never {
  if (error instanceof TenderNotFoundError) throw new ResourceNotFoundError(error.message);
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ConflictError("Código, versão ou hash documental já cadastrado.");
  }
  throw error;
}
