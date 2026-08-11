import { describe, expect, it, vi } from "vitest";

import type { SupportDiagnosis } from "../domain/support-ticket";
import { formatTicketTriagedMessage, TelegramNotifier } from "./telegram-notifier";

const diagnosis: SupportDiagnosis = {
  summary: "Resumo do diagnóstico",
  probableCause: "Causa provável",
  severity: "HIGH",
  changeClass: "CORRECTION",
  requiredActor: "AI",
  ownerActionCategory: null,
  requiredAction: null,
  securityGuidance: null,
  recommendedAction: "Ação recomendada",
  suggestedTests: ["Reproduzir o cenário"],
  userGuidance: "Acompanhe este chamado.",
  confidence: 0.8,
};

const ticket = { number: 42, title: "Erro ao salvar proposta" };

describe("formatTicketTriagedMessage", () => {
  it("inclui número, título, status e severidade", () => {
    const texto = formatTicketTriagedMessage(ticket, diagnosis, "TRIAGED", false);
    expect(texto).toContain("GUULY");
    expect(texto).toContain("#42");
    expect(texto).toContain("Erro ao salvar proposta");
    expect(texto).toContain("TRIAGED");
    expect(texto).toContain("Alta");
  });

  it("avisa quando precisa de aprovação do proprietário", () => {
    const texto = formatTicketTriagedMessage(ticket, diagnosis, "WAITING_APPROVAL", true);
    expect(texto).toContain("aprovação do proprietário");
  });

  it("não menciona aprovação quando ela não é exigida", () => {
    const texto = formatTicketTriagedMessage(ticket, diagnosis, "TRIAGED", false);
    expect(texto).not.toContain("aprovação do proprietário");
  });
});

describe("TelegramNotifier", () => {
  it("não chama a API quando o token não está configurado", async () => {
    const fetcher = vi.fn();
    await new TelegramNotifier("", "123", fetcher).notifyTicketTriaged(ticket, diagnosis, "TRIAGED", false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("não chama a API quando o chat_id não está configurado", async () => {
    const fetcher = vi.fn();
    await new TelegramNotifier("token-valido-de-teste", "", fetcher).notifyTicketTriaged(ticket, diagnosis, "TRIAGED", false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("envia a mensagem para a API do Telegram quando configurado", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await new TelegramNotifier("token-valido-de-teste", "123456", fetcher).notifyTicketTriaged(ticket, diagnosis, "TRIAGED", false);

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bottoken-valido-de-teste/sendMessage");
    const body = JSON.parse(init.body as string);
    expect(body.chat_id).toBe("123456");
    expect(body.text).toContain("GUULY");
    expect(body.text).toContain("#42");
  });

  it("não lança quando a API responde com erro HTTP", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("erro", { status: 401 }));
    await expect(new TelegramNotifier("t", "1", fetcher).notifyTicketTriaged(ticket, diagnosis, "TRIAGED", false)).resolves.toBeUndefined();
  });

  it("não lança quando a chamada de rede falha", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(new TelegramNotifier("t", "1", fetcher).notifyTicketTriaged(ticket, diagnosis, "TRIAGED", false)).resolves.toBeUndefined();
  });
});
