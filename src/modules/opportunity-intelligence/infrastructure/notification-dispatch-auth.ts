import { timingSafeEqual } from "node:crypto";

import { getEnvironment } from "@/core/config/env";
import { AuthorizationError, ConfigurationError } from "@/core/errors/application-error";

export function requireNotificationDispatcher(request: Request) {
  const expected = getEnvironment().NOTIFICATION_DISPATCH_TOKEN;
  if (!expected) {
    throw new ConfigurationError("O executor de notificações ainda não foi configurado.");
  }
  const authorization = request.headers.get("authorization");
  const supplied = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (
    expectedBuffer.length !== suppliedBuffer.length
    || !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    throw new AuthorizationError("Executor de notificações não autorizado.");
  }
}
