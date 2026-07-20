import { createHash, timingSafeEqual } from "node:crypto";
import { AuthorizationError, ConfigurationError } from "@/core/errors/application-error";

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function isSupportExecutorTokenValid(provided: string, expected: string) {
  if (!provided || !expected) return false;
  return timingSafeEqual(digest(provided), digest(expected));
}

export function requireSupportExecutor(request: Request) {
  const expected = process.env.SUPPORT_EXECUTOR_TOKEN?.trim();
  if (!expected) throw new ConfigurationError("O executor automatizado ainda não foi configurado.");
  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!isSupportExecutorTokenValid(provided, expected)) {
    throw new AuthorizationError("Credencial do executor inválida.", { reason: "SUPPORT_EXECUTOR_TOKEN_INVALID" });
  }
  return { actorId: "support-automation", actorType: "APPLICATION" as const };
}
