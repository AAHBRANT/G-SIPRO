import { Prisma } from "@/generated/prisma/client";
import { ConflictError, ValidationError } from "@/core/errors/application-error";
import { RectificationRuleError } from "@/modules/rectifications/application/rectification-service";
export function mapRectificationApiError(error: unknown): never { if (error instanceof RectificationRuleError) throw new ValidationError(error.message); if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictError("A versão documental já está registrada como retificação."); throw error; }
