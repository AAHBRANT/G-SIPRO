import pino, { type Logger } from "pino";

import type { AppEnvironment } from "@/core/config/env";
import { getRequestContext } from "@/core/observability/request-context";

const redactedPaths = [
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "req.headers.authorization",
  "*.password",
  "*.token",
];

export function createLogger(environment: Pick<AppEnvironment, "APP_NAME" | "APP_VERSION" | "LOG_LEVEL" | "NODE_ENV">): Logger {
  return pino({
    name: environment.APP_NAME,
    level: environment.LOG_LEVEL,
    base: {
      service: environment.APP_NAME,
      version: environment.APP_VERSION,
      environment: environment.NODE_ENV,
    },
    redact: {
      paths: redactedPaths,
      censor: "[REDACTED]",
    },
    mixin() {
      const context = getRequestContext();
      return context ? { correlationId: context.correlationId, actorId: context.actorId } : {};
    },
  });
}
