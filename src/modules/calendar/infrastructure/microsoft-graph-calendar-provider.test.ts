import { afterEach, describe, expect, it, vi } from "vitest";

import { resetEnvironmentCache } from "@/core/config/env";
import {
  MicrosoftGraphCalendarProvider,
  resetMicrosoftGraphCalendarTokenCache,
} from "./microsoft-graph-calendar-provider";

const baseEnvironment = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/gsipro",
  ENTRA_TENANT_ID: "8cc518ea-6df8-4d1e-a79f-89ee9314335c",
  ENTRA_CLIENT_ID: "e9db2cdd-b997-4e45-8d2e-8b3a64147367",
  ENTRA_CLIENT_SECRET: "segredo-de-cliente-com-tamanho-valido",
};

const event = {
  title: "Reunião com o cliente",
  description: "Alinhamento de escopo",
  startAt: new Date("2026-08-10T13:00:00.000Z"),
  endAt: new Date("2026-08-10T14:00:00.000Z"),
  allDay: false,
};

const configure = () => {
  for (const [key, value] of Object.entries(baseEnvironment)) vi.stubEnv(key, value);
};

const tokenResponse = () => new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), { status: 200 });

describe("Microsoft Graph calendar provider", () => {
  afterEach(() => {
    resetEnvironmentCache();
    resetMicrosoftGraphCalendarTokenCache();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("não chama o Graph quando a integração não está configurada", async () => {
    vi.stubEnv("DATABASE_URL", baseEnvironment.DATABASE_URL);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await new MicrosoftGraphCalendarProvider().createEvent("usuario@example.com", event);
    expect(result).toMatchObject({ status: "SKIPPED", errorCode: "GRAPH_NOT_CONFIGURED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cria o evento no calendário do responsável", async () => {
    configure();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "AAMk-evento-1" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new MicrosoftGraphCalendarProvider().createEvent("usuario@example.com", event);

    expect(result).toEqual({ status: "SYNCED", externalId: "AAMk-evento-1", errorCode: null });
    expect(fetchMock.mock.calls[1]?.[0]).toContain("usuario%40example.com/events");
    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(body.subject).toBe("Reunião com o cliente");
    expect(body.start.dateTime).toBe(event.startAt.toISOString());
    expect(body.end.dateTime).toBe(event.endAt.toISOString());
  });

  it("aplica uma duração padrão quando o compromisso não tem horário de término", async () => {
    configure();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "AAMk-evento-2" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await new MicrosoftGraphCalendarProvider().createEvent("usuario@example.com", { ...event, endAt: undefined });

    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(new Date(body.end.dateTime).getTime() - new Date(body.start.dateTime).getTime()).toBe(60 * 60 * 1000);
  });

  it("aplica duração padrão de um dia inteiro para compromissos allDay sem término", async () => {
    configure();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "AAMk-evento-3" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await new MicrosoftGraphCalendarProvider().createEvent("usuario@example.com", { ...event, endAt: undefined, allDay: true });

    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(new Date(body.end.dateTime).getTime() - new Date(body.start.dateTime).getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("inclui os participantes como convidados do evento", async () => {
    configure();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "AAMk-evento-4" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await new MicrosoftGraphCalendarProvider().createEvent("usuario@example.com", {
      ...event,
      attendees: [{ email: "colega@example.com", name: "Colega" }, { email: "outro@example.com" }],
    });

    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(body.attendees).toEqual([
      { emailAddress: { address: "colega@example.com", name: "Colega" }, type: "required" },
      { emailAddress: { address: "outro@example.com" }, type: "required" },
    ]);
  });

  it("não envia o campo attendees quando não há participantes", async () => {
    configure();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "AAMk-evento-5" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await new MicrosoftGraphCalendarProvider().createEvent("usuario@example.com", event);

    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(body).not.toHaveProperty("attendees");
  });

  it("atualiza um evento existente pelo id externo", async () => {
    configure();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "AAMk-evento-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new MicrosoftGraphCalendarProvider().updateEvent("usuario@example.com", "AAMk-evento-1", event);

    expect(result).toEqual({ status: "SYNCED", externalId: "AAMk-evento-1", errorCode: null });
    expect(fetchMock.mock.calls[1]?.[0]).toContain("usuario%40example.com/events/AAMk-evento-1");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("PATCH");
  });

  it("reporta falha quando o evento a ser atualizado não existe mais no Outlook", async () => {
    configure();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new MicrosoftGraphCalendarProvider().updateEvent("usuario@example.com", "AAMk-evento-1", event);

    expect(result).toEqual({ status: "FAILED", externalId: null, errorCode: "GRAPH_EVENT_NOT_FOUND" });
  });

  it("exclui um evento e trata 404 como sucesso (já não existe mesmo)", async () => {
    configure();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new MicrosoftGraphCalendarProvider().deleteEvent("usuario@example.com", "AAMk-evento-1");

    expect(result).toEqual({ status: "SYNCED", externalId: null, errorCode: null });
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("DELETE");
  });

  it("reporta falha em vez de lançar exceção quando o Graph está indisponível", async () => {
    configure();
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new MicrosoftGraphCalendarProvider().createEvent("usuario@example.com", event);

    expect(result.status).toBe("FAILED");
    expect(result.externalId).toBeNull();
  });
});
