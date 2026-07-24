import { randomUUID } from "node:crypto";

import { getEnvironment } from "@/core/config/env";
import { getDatabase } from "@/core/database/prisma";

type GraphConfiguration = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  catalogAppId: string;
  timeoutMs: number;
};

export type TeamsProvisioningResult = {
  status: "INSTALLED" | "FAILED" | "NOT_CONFIGURED";
  errorCode: string | null;
  message: string;
};

type TokenCache = { accessToken: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

function getGraphConfiguration(): GraphConfiguration | null {
  const environment = getEnvironment();
  if (!environment.ENTRA_TENANT_ID || !environment.ENTRA_CLIENT_ID || !environment.ENTRA_CLIENT_SECRET || !environment.TEAMS_CATALOG_APP_ID) return null;
  return {
    tenantId: environment.ENTRA_TENANT_ID,
    clientId: environment.ENTRA_CLIENT_ID,
    clientSecret: environment.ENTRA_CLIENT_SECRET,
    catalogAppId: environment.TEAMS_CATALOG_APP_ID,
    timeoutMs: environment.MICROSOFT_GRAPH_TIMEOUT_MS,
  };
}

async function graphFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

async function getApplicationToken(configuration: GraphConfiguration): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.accessToken;
  const body = new URLSearchParams({
    client_id: configuration.clientId,
    client_secret: configuration.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const response = await graphFetch(
    `https://login.microsoftonline.com/${configuration.tenantId}/oauth2/v2.0/token`,
    { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body },
    configuration.timeoutMs,
  );
  if (!response.ok) throw new GraphProvisioningError("GRAPH_AUTHENTICATION_FAILED");
  const payload = await response.json() as { access_token?: string; expires_in?: number };
  if (!payload.access_token) throw new GraphProvisioningError("GRAPH_AUTHENTICATION_FAILED");
  tokenCache = { accessToken: payload.access_token, expiresAt: Date.now() + Math.max(60, payload.expires_in ?? 3_600) * 1_000 };
  return payload.access_token;
}

class GraphProvisioningError extends Error {
  constructor(readonly safeCode: string) {
    super(safeCode);
  }
}

export function classifyGraphFailure(status: number): string {
  if (status === 400) return "TEAMS_APP_CONFIGURATION_INVALID";
  if (status === 401 || status === 403) return "GRAPH_PERMISSION_REQUIRED";
  if (status === 404) return "ENTRA_USER_NOT_FOUND";
  if (status === 429 || status >= 500) return "GRAPH_TEMPORARY_FAILURE";
  return "GRAPH_INSTALLATION_FAILED";
}

export async function installTeamsAppForUser(email: string): Promise<TeamsProvisioningResult> {
  const configuration = getGraphConfiguration();
  if (!configuration) return { status: "NOT_CONFIGURED", errorCode: "GRAPH_NOT_CONFIGURED", message: "Integração do Microsoft Teams ainda não configurada." };
  try {
    const accessToken = await getApplicationToken(configuration);
    const response = await graphFetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/teamwork/installedApps`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({
          "teamsApp@odata.bind": `https://graph.microsoft.com/v1.0/appCatalogs/teamsApps/${configuration.catalogAppId}`,
        }),
      },
      configuration.timeoutMs,
    );
    if (response.ok || response.status === 409) {
      return { status: "INSTALLED", errorCode: null, message: response.status === 409 ? "O aplicativo já estava instalado para este usuário." : "Aplicativo instalado automaticamente no Microsoft Teams." };
    }
    return { status: "FAILED", errorCode: classifyGraphFailure(response.status), message: "Usuário cadastrado; a instalação no Teams será tentada novamente." };
  } catch (error) {
    const errorCode = error instanceof GraphProvisioningError ? error.safeCode : error instanceof DOMException && error.name === "AbortError" ? "GRAPH_TIMEOUT" : "GRAPH_UNAVAILABLE";
    return { status: "FAILED", errorCode, message: "Usuário cadastrado; o Microsoft Graph está temporariamente indisponível." };
  }
}

export async function provisionTeamsAppForManagedUser(input: {
  userId: string;
  email: string;
  actorId: string;
  correlationId: string;
}): Promise<TeamsProvisioningResult> {
  const database = getDatabase();
  const attemptedAt = new Date();
  await database.user.update({
    where: { id: input.userId },
    data: {
      teamsProvisioningStatus: "PENDING",
      teamsProvisioningAttempts: { increment: 1 },
      teamsProvisioningLastAttemptAt: attemptedAt,
      teamsProvisioningErrorCode: null,
    },
  });
  const result = await installTeamsAppForUser(input.email);
  await database.$transaction([
    database.user.update({
      where: { id: input.userId },
      data: {
        teamsProvisioningStatus: result.status,
        teamsProvisioningErrorCode: result.errorCode,
        teamsProvisionedAt: result.status === "INSTALLED" ? new Date() : null,
      },
    }),
    database.auditEvent.create({
      data: {
        id: randomUUID(),
        actorType: "USER",
        actorId: input.actorId,
        action: result.status === "INSTALLED" ? "TEAMS_APP_PROVISIONED" : "TEAMS_APP_PROVISIONING_FAILED",
        entityType: "USER",
        entityId: input.userId,
        correlationId: input.correlationId,
        outcome: result.status === "INSTALLED" ? "SUCCESS" : "FAILURE",
        origin: "microsoft-graph-user-provisioning",
        metadata: { errorCode: result.errorCode, attemptedAt: attemptedAt.toISOString() },
      },
    }),
  ]);
  return result;
}

export function resetMicrosoftGraphTokenCache(): void {
  tokenCache = null;
}
