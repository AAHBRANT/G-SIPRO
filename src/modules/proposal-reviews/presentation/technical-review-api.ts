import { ConflictError, ResourceNotFoundError, ValidationError } from "@/core/errors/application-error";
import { Prisma } from "@/generated/prisma/client";
import { TechnicalReviewNotFoundError, TechnicalReviewRuleError } from "@/modules/proposal-reviews/infrastructure/prisma-technical-review-repository";
export function mapTechnicalReviewApiError(error:unknown):never{if(error instanceof TechnicalReviewNotFoundError)throw new ResourceNotFoundError(error.message);if(error instanceof TechnicalReviewRuleError)throw new ValidationError(error.message);if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002")throw new ConflictError("Este vínculo já foi registrado.");throw error}
