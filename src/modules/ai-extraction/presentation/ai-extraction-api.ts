import { ValidationError } from "@/core/errors/application-error";
import { AiExtractionRuleError } from "../domain/ai-extraction";

export function mapAiExtractionApiError(error: unknown): never {
  if (error instanceof AiExtractionRuleError) throw new ValidationError(error.message);
  throw error;
}
