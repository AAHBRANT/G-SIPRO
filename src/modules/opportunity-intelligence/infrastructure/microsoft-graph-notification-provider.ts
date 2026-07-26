import { getEnvironment } from "@/core/config/env";
import {
  prismaNotificationSenderSettingsReader,
  type NotificationSenderSettingsReader,
} from "@/modules/admin/notification-settings-service";

export type NotificationDeliveryResult = {
  status: "ACCEPTED" | "SKIPPED" | "RETRY" | "FAILED";
  errorCode: string | null;
  providerReference: string | null;
};

type GraphConfiguration = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  timeoutMs: number;
  appBaseUrl: string;
  emailSender: string | null;
};

type NotificationMessage = {
  recipientEmail: string;
  recipientTeamsStatus: "NOT_CONFIGURED" | "PENDING" | "INSTALLED" | "FAILED";
  summary: string;
  nextAction: string;
  deepLink: string;
  eventId: string;
};

let tokenCache: { accessToken: string; expiresAt: number } | null = null;

export function resetMicrosoftGraphNotificationTokenCache() {
  tokenCache = null;
}

const configuration = async (settingsReader: NotificationSenderSettingsReader): Promise<GraphConfiguration | null> => {
  const environment = getEnvironment();
  if (!environment.ENTRA_TENANT_ID || !environment.ENTRA_CLIENT_ID || !environment.ENTRA_CLIENT_SECRET) return null;
  if (!environment.AUTH_URL) return null;
  const configuredSender = await settingsReader.getEmailSender();
  return {
    tenantId: environment.ENTRA_TENANT_ID,
    clientId: environment.ENTRA_CLIENT_ID,
    clientSecret: environment.ENTRA_CLIENT_SECRET,
    timeoutMs: environment.MICROSOFT_GRAPH_TIMEOUT_MS,
    appBaseUrl: environment.AUTH_URL.replace(/\/$/, ""),
    emailSender: configuredSender || environment.NOTIFICATION_EMAIL_SENDER || null,
  };
};

const graphFetch = async (url: string, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
};

const getToken = async (config: GraphConfiguration) => {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.accessToken;
  const response = await graphFetch(
    `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    },
    config.timeoutMs,
  );
  if (!response.ok) throw new Error("GRAPH_AUTHENTICATION_FAILED");
  const body = await response.json() as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("GRAPH_AUTHENTICATION_FAILED");
  tokenCache = {
    accessToken: body.access_token,
    expiresAt: Date.now() + Math.max(60, body.expires_in ?? 3600) * 1000,
  };
  return body.access_token;
};

const classifyFailure = (status: number): NotificationDeliveryResult => {
  if (status === 429 || status >= 500) {
    return { status: "RETRY", errorCode: "GRAPH_TEMPORARY_FAILURE", providerReference: null };
  }
  if (status === 401 || status === 403) {
    return { status: "FAILED", errorCode: "GRAPH_PERMISSION_REQUIRED", providerReference: null };
  }
  if (status === 404) {
    return { status: "FAILED", errorCode: "GRAPH_RECIPIENT_NOT_FOUND", providerReference: null };
  }
  return { status: "FAILED", errorCode: "GRAPH_REQUEST_REJECTED", providerReference: null };
};

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

export class MicrosoftGraphNotificationProvider {
  constructor(private readonly settingsReader: NotificationSenderSettingsReader = prismaNotificationSenderSettingsReader) {}

  async sendTeams(message: NotificationMessage): Promise<NotificationDeliveryResult> {
    const config = await configuration(this.settingsReader);
    if (!config) return { status: "SKIPPED", errorCode: "GRAPH_NOT_CONFIGURED", providerReference: null };
    if (message.recipientTeamsStatus !== "INSTALLED") {
      return { status: "SKIPPED", errorCode: "TEAMS_APP_NOT_INSTALLED", providerReference: null };
    }
    try {
      const token = await getToken(config);
      const webUrl = `${config.appBaseUrl}${message.deepLink}`;
      const response = await graphFetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(message.recipientEmail)}/teamwork/sendActivityNotification`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({
            topic: { source: "text", value: "G-SIPRO", webUrl },
            activityType: "gsiproOpportunityNotification",
            previewText: { content: message.summary.slice(0, 150) },
            templateParameters: [{ name: "summary", value: message.summary.slice(0, 120) }],
            chainId: BigInt(`0x${message.eventId.replaceAll("-", "").slice(0, 15)}`).toString(),
          }),
        },
        config.timeoutMs,
      );
      if (response.status === 204) {
        return { status: "ACCEPTED", errorCode: null, providerReference: message.eventId };
      }
      return classifyFailure(response.status);
    } catch (error) {
      const code = error instanceof Error ? error.message : "GRAPH_UNEXPECTED_FAILURE";
      return {
        status: code === "GRAPH_AUTHENTICATION_FAILED" ? "FAILED" : "RETRY",
        errorCode: code,
        providerReference: null,
      };
    }
  }

  async sendEmail(message: NotificationMessage): Promise<NotificationDeliveryResult> {
    const config = await configuration(this.settingsReader);
    if (!config) return { status: "SKIPPED", errorCode: "GRAPH_NOT_CONFIGURED", providerReference: null };
    if (!config.emailSender) {
      return { status: "SKIPPED", errorCode: "EMAIL_SENDER_NOT_CONFIGURED", providerReference: null };
    }
    try {
      const token = await getToken(config);
      const webUrl = `${config.appBaseUrl}${message.deepLink}`;
      const response = await graphFetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.emailSender)}/sendMail`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({
            message: {
              subject: `G-SIPRO — ${message.summary}`,
              body: {
                contentType: "HTML",
                content: `<p>${escapeHtml(message.summary)}</p><p><strong>Próxima ação:</strong> ${escapeHtml(message.nextAction)}</p><p><a href="${escapeHtml(webUrl)}">Abrir no G-SIPRO</a></p>`,
              },
              toRecipients: [{ emailAddress: { address: message.recipientEmail } }],
            },
            saveToSentItems: true,
          }),
        },
        config.timeoutMs,
      );
      if (response.status === 202) {
        return { status: "ACCEPTED", errorCode: null, providerReference: message.eventId };
      }
      return classifyFailure(response.status);
    } catch (error) {
      const code = error instanceof Error ? error.message : "GRAPH_UNEXPECTED_FAILURE";
      return {
        status: code === "GRAPH_AUTHENTICATION_FAILED" ? "FAILED" : "RETRY",
        errorCode: code,
        providerReference: null,
      };
    }
  }
}
