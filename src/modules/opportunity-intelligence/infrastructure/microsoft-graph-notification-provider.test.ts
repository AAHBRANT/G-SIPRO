import { afterEach, describe, expect, it, vi } from "vitest";

import { resetEnvironmentCache } from "@/core/config/env";
import {
  MicrosoftGraphNotificationProvider,
  resetMicrosoftGraphNotificationTokenCache,
} from "./microsoft-graph-notification-provider";

const baseEnvironment = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/gsipro",
  ENTRA_TENANT_ID: "8cc518ea-6df8-4d1e-a79f-89ee9314335c",
  ENTRA_CLIENT_ID: "e9db2cdd-b997-4e45-8d2e-8b3a64147367",
  ENTRA_CLIENT_SECRET: "segredo-de-cliente-com-tamanho-valido",
  AUTH_URL: "https://gsipro.example.com",
  NOTIFICATION_EMAIL_SENDER: "gsipro@example.com",
  TEAMS_CATALOG_APP_ID: "a3e5f89d-b77d-4fd7-a4dd-ed88c36af16c",
};
const message = {
  recipientEmail: "usuario+teste@example.com",
  recipientTeamsStatus: "INSTALLED" as const,
  summary: "A análise precisa de decisão do proprietário.",
  nextAction: "Abra o painel e registre a decisão.",
  deepLink: "/opportunities/00000000-0000-4000-8000-000000000001",
  eventId: "00000000-0000-4000-8000-000000000002",
};

const configure = () => {
  for (const [key, value] of Object.entries(baseEnvironment)) vi.stubEnv(key, value);
};

const noStoredSender = { getEmailSender: async () => null };

describe("Microsoft Graph notification provider", () => {
  afterEach(() => {
    resetEnvironmentCache();
    resetMicrosoftGraphNotificationTokenCache();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("does not call Graph when integration is absent", async () => {
    vi.stubEnv("DATABASE_URL", baseEnvironment.DATABASE_URL);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await new MicrosoftGraphNotificationProvider(noStoredSender).sendTeams(message);
    expect(result).toMatchObject({ status: "SKIPPED", errorCode: "GRAPH_NOT_CONFIGURED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a templated Teams activity with an authenticated deep link", async () => {
    configure();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new MicrosoftGraphNotificationProvider(noStoredSender).sendTeams(message);
    expect(result.status).toBe("ACCEPTED");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("usuario%2Bteste%40example.com/teamwork/sendActivityNotification");
    const body = String(fetchMock.mock.calls[1]?.[1]?.body);
    expect(body).toContain("gsiproOpportunityNotification");
    // O Teams recusa link comum como webUrl de atividade (erro 400) — precisa ser
    // um link de entidade do próprio Teams (teams.microsoft.com/l/entity/...).
    expect(body).toContain("https://teams.microsoft.com/l/entity/a3e5f89d-b77d-4fd7-a4dd-ed88c36af16c/gsipro-home");
    expect(body).toContain(encodeURIComponent("https://gsipro.example.com/opportunities/"));
    expect(body).toContain(encodeURIComponent(JSON.stringify({ subEntityId: message.deepLink })));
  });

  it("não envia notificação no Teams quando o app publicado no catálogo não está configurado", async () => {
    for (const [key, value] of Object.entries(baseEnvironment)) {
      if (key !== "TEAMS_CATALOG_APP_ID") vi.stubEnv(key, value);
    }
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await new MicrosoftGraphNotificationProvider(noStoredSender).sendTeams(message);
    expect(result).toMatchObject({ status: "SKIPPED", errorCode: "TEAMS_CATALOG_APP_NOT_CONFIGURED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("records email as accepted, without claiming delivery", async () => {
    configure();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new MicrosoftGraphNotificationProvider(noStoredSender).sendEmail(message);
    expect(result).toMatchObject({ status: "ACCEPTED" });
    expect(fetchMock.mock.calls[1]?.[0]).toContain("gsipro%40example.com/sendMail");
  });

  it("usa o remetente configurado no banco em vez da variável de ambiente, quando presente", async () => {
    configure();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const storedSender = { getEmailSender: async () => "notificacoes@aahbrant.com" };
    const result = await new MicrosoftGraphNotificationProvider(storedSender).sendEmail(message);
    expect(result).toMatchObject({ status: "ACCEPTED" });
    expect(fetchMock.mock.calls[1]?.[0]).toContain("notificacoes%40aahbrant.com/sendMail");
  });

  it("does not attempt Teams delivery before app installation", async () => {
    configure();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await new MicrosoftGraphNotificationProvider(noStoredSender).sendTeams({
      ...message,
      recipientTeamsStatus: "PENDING",
    });
    expect(result).toMatchObject({ status: "SKIPPED", errorCode: "TEAMS_APP_NOT_INSTALLED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
