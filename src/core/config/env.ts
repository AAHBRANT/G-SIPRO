import { z } from "zod";

import { ConfigurationError } from "@/core/errors/application-error";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().trim().min(1).default("G-SIPRO"),
  APP_VERSION: z.string().trim().min(1).default("0.1.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().startsWith("postgresql://"),
  ENTRA_TENANT_ID: z.string().uuid().optional().or(z.literal("")),
  ENTRA_CLIENT_ID: z.string().uuid().optional().or(z.literal("")),
  ENTRA_CLIENT_SECRET: z.string().min(16).optional().or(z.literal("")),
  TEAMS_CATALOG_APP_ID: z.string().uuid().optional().or(z.literal("")),
  MICROSOFT_GRAPH_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(60_000).default(20_000),
  NOTIFICATION_DISPATCH_TOKEN: z.string().min(32).optional().or(z.literal("")),
  NOTIFICATION_EMAIL_SENDER: z.email().optional().or(z.literal("")),
  AUTH_SECRET: z.string().min(32).optional().or(z.literal("")),
  AUTH_URL: z.url().optional().or(z.literal("")),
  OPENAI_API_KEY: z.string().min(20).optional().or(z.literal("")),
  OPENAI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(300_000).default(120_000),
  CENTRAL_IA_BASE_URL: z.url().optional().or(z.literal("")),
  CENTRAL_IA_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(300_000).default(120_000),
  SUPPORT_EXECUTOR_TOKEN: z.string().min(32).optional().or(z.literal("")),
});

export type AppEnvironment = z.infer<typeof environmentSchema>;

let cachedEnvironment: AppEnvironment | undefined;

export function parseEnvironment(input: Readonly<Record<string, string | undefined>>): AppEnvironment {
  const result = environmentSchema.safeParse(input);

  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join(".") || "environment");
    throw new ConfigurationError("Configuração de ambiente inválida.", { fields });
  }

  return result.data;
}

export function getEnvironment(): AppEnvironment {
  cachedEnvironment ??= parseEnvironment(process.env);
  return cachedEnvironment;
}

export function resetEnvironmentCache(): void {
  cachedEnvironment = undefined;
}
