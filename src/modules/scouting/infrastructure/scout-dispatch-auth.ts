import { timingSafeEqual } from "node:crypto";

import { getEnvironment } from "@/core/config/env";
import { AuthorizationError, ConfigurationError } from "@/core/errors/application-error";

/**
 * Autoriza o disparo automático da varredura semanal. Segue o mesmo contrato do
 * executor de notificações: token dedicado, enviado pelo agendador, comparado em
 * tempo constante.
 */
export function requireScoutDispatcher(request: Request): void {
  const expected = getEnvironment().SCOUT_DISPATCH_TOKEN;
  if (!expected) {
    throw new ConfigurationError("O executor do Buscador ainda não foi configurado.");
  }
  const authorization = request.headers.get("authorization");
  const supplied = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (
    expectedBuffer.length !== suppliedBuffer.length
    || !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    throw new AuthorizationError("Executor do Buscador não autorizado.");
  }
}
