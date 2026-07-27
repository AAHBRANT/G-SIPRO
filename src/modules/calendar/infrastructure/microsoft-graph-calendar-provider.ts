import { getEnvironment } from "@/core/config/env";

export type GraphCalendarSyncResult = {
  status: "SYNCED" | "SKIPPED" | "FAILED";
  externalId: string | null;
  errorCode: string | null;
};

export type GraphCalendarAttendee = {
  email: string;
  name?: string;
};

export type GraphCalendarEventInput = {
  title: string;
  description?: string;
  startAt: Date;
  endAt?: Date;
  allDay: boolean;
  attendees?: readonly GraphCalendarAttendee[];
};

type GraphCalendarConfiguration = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  timeoutMs: number;
};

let tokenCache: { accessToken: string; expiresAt: number } | null = null;

export function resetMicrosoftGraphCalendarTokenCache() {
  tokenCache = null;
}

function configuration(): GraphCalendarConfiguration | null {
  const environment = getEnvironment();
  if (!environment.ENTRA_TENANT_ID || !environment.ENTRA_CLIENT_ID || !environment.ENTRA_CLIENT_SECRET) return null;
  return {
    tenantId: environment.ENTRA_TENANT_ID,
    clientId: environment.ENTRA_CLIENT_ID,
    clientSecret: environment.ENTRA_CLIENT_SECRET,
    timeoutMs: environment.MICROSOFT_GRAPH_TIMEOUT_MS,
  };
}

const graphFetch = async (url: string, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
};

const getToken = async (config: GraphCalendarConfiguration) => {
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

// Todo evento no Graph exige start/end; um compromisso do G-SIPRO pode não ter
// duração definida, então aplica uma duração padrão só para o envio ao Outlook.
function toGraphEventBody(event: GraphCalendarEventInput) {
  const defaultDurationMs = event.allDay ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  const endAt = event.endAt ?? new Date(event.startAt.getTime() + defaultDurationMs);
  return {
    subject: event.title,
    ...(event.description && { body: { contentType: "text", content: event.description } }),
    isAllDay: event.allDay,
    start: { dateTime: event.startAt.toISOString(), timeZone: "UTC" },
    end: { dateTime: endAt.toISOString(), timeZone: "UTC" },
    ...(event.attendees && event.attendees.length > 0 && {
      attendees: event.attendees.map((attendee) => ({
        emailAddress: { address: attendee.email, ...(attendee.name && { name: attendee.name }) },
        type: "required",
      })),
    }),
  };
}

export class MicrosoftGraphCalendarProvider {
  async createEvent(userEmail: string, event: GraphCalendarEventInput): Promise<GraphCalendarSyncResult> {
    const config = configuration();
    if (!config) return { status: "SKIPPED", externalId: null, errorCode: "GRAPH_NOT_CONFIGURED" };
    try {
      const token = await getToken(config);
      const response = await graphFetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}/events`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify(toGraphEventBody(event)),
        },
        config.timeoutMs,
      );
      if (!response.ok) return { status: "FAILED", externalId: null, errorCode: `GRAPH_STATUS_${response.status}` };
      const body = await response.json() as { id?: string };
      if (!body.id) return { status: "FAILED", externalId: null, errorCode: "GRAPH_MISSING_EVENT_ID" };
      return { status: "SYNCED", externalId: body.id, errorCode: null };
    } catch (error) {
      return { status: "FAILED", externalId: null, errorCode: error instanceof Error ? error.message : "GRAPH_UNEXPECTED_FAILURE" };
    }
  }

  async updateEvent(userEmail: string, externalId: string, event: GraphCalendarEventInput): Promise<GraphCalendarSyncResult> {
    const config = configuration();
    if (!config) return { status: "SKIPPED", externalId: null, errorCode: "GRAPH_NOT_CONFIGURED" };
    try {
      const token = await getToken(config);
      const response = await graphFetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}/events/${encodeURIComponent(externalId)}`,
        {
          method: "PATCH",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify(toGraphEventBody(event)),
        },
        config.timeoutMs,
      );
      if (response.status === 404) return { status: "FAILED", externalId: null, errorCode: "GRAPH_EVENT_NOT_FOUND" };
      if (!response.ok) return { status: "FAILED", externalId, errorCode: `GRAPH_STATUS_${response.status}` };
      return { status: "SYNCED", externalId, errorCode: null };
    } catch (error) {
      return { status: "FAILED", externalId, errorCode: error instanceof Error ? error.message : "GRAPH_UNEXPECTED_FAILURE" };
    }
  }

  async deleteEvent(userEmail: string, externalId: string): Promise<GraphCalendarSyncResult> {
    const config = configuration();
    if (!config) return { status: "SKIPPED", externalId: null, errorCode: "GRAPH_NOT_CONFIGURED" };
    try {
      const token = await getToken(config);
      const response = await graphFetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}/events/${encodeURIComponent(externalId)}`,
        { method: "DELETE", headers: { authorization: `Bearer ${token}` } },
        config.timeoutMs,
      );
      if (!response.ok && response.status !== 404) {
        return { status: "FAILED", externalId, errorCode: `GRAPH_STATUS_${response.status}` };
      }
      return { status: "SYNCED", externalId: null, errorCode: null };
    } catch (error) {
      return { status: "FAILED", externalId, errorCode: error instanceof Error ? error.message : "GRAPH_UNEXPECTED_FAILURE" };
    }
  }
}
