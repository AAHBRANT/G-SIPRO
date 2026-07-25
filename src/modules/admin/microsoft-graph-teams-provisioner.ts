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

export type EntraIdentityResolution = {
  status: "RESOLVED" | "NOT_FOUND" | "FAILED" | "NOT_CONFIGURED";
  objectId: string | null;
  errorCode: string | null;
  message: string;
};

type TokenCache = { accessToken: string; expiresAt: number };
let tokenCache: TokenCache | null = null;
const catalogIdCache = new Map<string, string>();

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

async function resolveCatalogAppId(configuration: GraphConfiguration, accessToken: string): Promise<string> {
  const cached = catalogIdCache.get(configuration.catalogAppId);
  if (cached) return cached;
  const query = new URLSearchParams({
    "$filter": `externalId eq '${configuration.catalogAppId.replaceAll("'", "''")}'`,
    "$select": "id,externalId,displayName,distributionMethod",
  });
  const response = await graphFetch(
    `https://graph.microsoft.com/v1.0/appCatalogs/teamsApps?${query.toString()}`,
    { method: "GET", headers: { authorization: `Bearer ${accessToken}` } },
    configuration.timeoutMs,
  );
  if (response.status === 401 || response.status === 403) throw new GraphProvisioningError("GRAPH_APP_CATALOG_PERMISSION_REQUIRED");
  if (!response.ok) throw new GraphProvisioningError("GRAPH_APP_CATALOG_LOOKUP_FAILED");
  const payload = await response.json() as { value?: Array<{ id?: string }> };
  const resolved = payload.value?.find((item) => typeof item.id === "string")?.id;
  if (!resolved) throw new GraphProvisioningError("TEAMS_APP_NOT_PUBLISHED");
  catalogIdCache.set(configuration.catalogAppId, resolved);
  return resolved;
}

async function installUsingCatalogId(input: {
  email: string;
  catalogAppId: string;
  accessToken: string;
  timeoutMs: number;
}): Promise<Response> {
  return graphFetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(input.email)}/teamwork/installedApps`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${input.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        "teamsApp@odata.bind": `https://graph.microsoft.com/v1.0/appCatalogs/teamsApps/${input.catalogAppId}`,
      }),
    },
    input.timeoutMs,
  );
}

function safeProvisioningMessage(errorCode: string): string {
  const messages: Record<string, string> = {
    GRAPH_APP_CATALOG_PERMISSION_REQUIRED: "O Microsoft Graph precisa da permissão AppCatalog.Read.All para localizar o aplicativo publicado no catálogo do Teams.",
    GRAPH_APP_CATALOG_LOOKUP_FAILED: "O catálogo de aplicativos do Teams não respondeu. Tente novamente em alguns minutos.",
    TEAMS_APP_NOT_PUBLISHED: "O G-SIPRO não foi localizado no catálogo corporativo do Teams. Confirme a publicação do aplicativo.",
    GRAPH_PERMISSION_REQUIRED: "O Microsoft Graph recusou a instalação. Confirme o consentimento administrativo das permissões de instalação por usuário.",
    ENTRA_USER_NOT_FOUND: "O usuário não foi localizado no Microsoft Entra ID. Confirme o e-mail corporativo e a existência da conta.",
    TEAMS_APP_CONFIGURATION_INVALID: "O identificador do aplicativo do Teams está incorreto ou ainda não foi propagado no catálogo.",
    GRAPH_TEMPORARY_FAILURE: "O Microsoft Graph está temporariamente indisponível. A tentativa pode ser repetida.",
    GRAPH_TIMEOUT: "O Microsoft Graph excedeu o tempo de resposta. A tentativa pode ser repetida.",
  };
  return messages[errorCode] ?? "A instalação no Microsoft Teams não foi concluída. Consulte o código seguro apresentado.";
}

export async function resolveEntraIdentityByEmail(email: string): Promise<EntraIdentityResolution> {
  const configuration = getGraphConfiguration();
  if (!configuration) {
    return {
      status: "NOT_CONFIGURED",
      objectId: null,
      errorCode: "GRAPH_NOT_CONFIGURED",
      message: "Acesso interno liberado. A vinculação automática ao Microsoft Entra ainda não está configurada.",
    };
  }
  try {
    const accessToken = await getApplicationToken(configuration);
    const query = new URLSearchParams({ "$select": "id,mail,userPrincipalName,accountEnabled" });
    const response = await graphFetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}?${query.toString()}`,
      { method: "GET", headers: { authorization: `Bearer ${accessToken}` } },
      configuration.timeoutMs,
    );
    if (response.status === 404) {
      return {
        status: "NOT_FOUND",
        objectId: null,
        errorCode: "ENTRA_USER_NOT_FOUND",
        message: "A conta ainda não existe no Microsoft Entra ID. Crie ou confirme a conta corporativa e tente novamente.",
      };
    }
    if (response.status === 401 || response.status === 403) {
      return {
        status: "FAILED",
        objectId: null,
        errorCode: "GRAPH_USER_READ_PERMISSION_REQUIRED",
        message: "Acesso interno liberado. Para vincular automaticamente a identidade, conceda User.Read.All ao aplicativo no Microsoft Graph com consentimento administrativo.",
      };
    }
    if (!response.ok) {
      return {
        status: "FAILED",
        objectId: null,
        errorCode: classifyGraphFailure(response.status),
        message: "Acesso interno liberado. O Microsoft Entra não respondeu à vinculação automática; ela será repetida no primeiro acesso.",
      };
    }
    const payload = await response.json() as { id?: string; accountEnabled?: boolean };
    if (!payload.id) {
      return {
        status: "FAILED",
        objectId: null,
        errorCode: "ENTRA_OBJECT_ID_MISSING",
        message: "Acesso interno liberado. O Microsoft Entra não retornou o identificador da conta.",
      };
    }
    if (payload.accountEnabled === false) {
      return {
        status: "FAILED",
        objectId: null,
        errorCode: "ENTRA_USER_DISABLED",
        message: "A conta existe no Microsoft Entra, mas está desabilitada. Ative-a antes de acessar o G-SIPRO.",
      };
    }
    return {
      status: "RESOLVED",
      objectId: payload.id,
      errorCode: null,
      message: "Identidade corporativa vinculada automaticamente.",
    };
  } catch (error) {
    const errorCode = error instanceof GraphProvisioningError
      ? error.safeCode
      : error instanceof DOMException && error.name === "AbortError"
        ? "GRAPH_TIMEOUT"
        : "GRAPH_UNAVAILABLE";
    return {
      status: "FAILED",
      objectId: null,
      errorCode,
      message: "Acesso interno liberado. A vinculação ao Microsoft Entra será repetida no primeiro acesso.",
    };
  }
}

export async function installTeamsAppForUser(email: string): Promise<TeamsProvisioningResult> {
  const configuration = getGraphConfiguration();
  if (!configuration) return { status: "NOT_CONFIGURED", errorCode: "GRAPH_NOT_CONFIGURED", message: "Integração do Microsoft Teams ainda não configurada." };
  try {
    const accessToken = await getApplicationToken(configuration);
    let response = await installUsingCatalogId({
      email,
      catalogAppId: configuration.catalogAppId,
      accessToken,
      timeoutMs: configuration.timeoutMs,
    });
    if (response.status === 400 || response.status === 404) {
      const resolvedCatalogAppId = await resolveCatalogAppId(configuration, accessToken);
      if (resolvedCatalogAppId !== configuration.catalogAppId) {
        response = await installUsingCatalogId({
          email,
          catalogAppId: resolvedCatalogAppId,
          accessToken,
          timeoutMs: configuration.timeoutMs,
        });
      }
    }
    if (response.ok || response.status === 409) {
      return { status: "INSTALLED", errorCode: null, message: response.status === 409 ? "O aplicativo já estava instalado para este usuário." : "Aplicativo instalado automaticamente no Microsoft Teams." };
    }
    const errorCode = classifyGraphFailure(response.status);
    return { status: "FAILED", errorCode, message: safeProvisioningMessage(errorCode) };
  } catch (error) {
    const errorCode = error instanceof GraphProvisioningError ? error.safeCode : error instanceof DOMException && error.name === "AbortError" ? "GRAPH_TIMEOUT" : "GRAPH_UNAVAILABLE";
    return { status: "FAILED", errorCode, message: safeProvisioningMessage(errorCode) };
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
  const identity = await resolveEntraIdentityByEmail(input.email);
  if (identity.status === "RESOLVED" && identity.objectId) {
    await database.user.update({
      where: { id: input.userId },
      data: { entraObjectId: identity.objectId, updatedBy: input.actorId },
    });
  }
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
        metadata: {
          errorCode: result.errorCode,
          attemptedAt: attemptedAt.toISOString(),
          identityStatus: identity.status,
          identityErrorCode: identity.errorCode,
        },
      },
    }),
  ]);
  if (result.status === "INSTALLED" && identity.status !== "RESOLVED") {
    return {
      ...result,
      message: `${result.message} ${identity.message}`,
    };
  }
  return result;
}

export function resetMicrosoftGraphTokenCache(): void {
  tokenCache = null;
  catalogIdCache.clear();
}
