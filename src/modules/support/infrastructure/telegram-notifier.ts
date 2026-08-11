import { createLogger } from "@/core/observability/logger";
import type { SupportDiagnosis } from "@/modules/support/domain/support-ticket";

const TELEGRAM_API_BASE = "https://api.telegram.org";

function notifierLogger() {
  const logLevel = process.env.LOG_LEVEL as "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent" | undefined;
  return createLogger({
    APP_NAME: process.env.APP_NAME || "G-SIPRO",
    APP_VERSION: process.env.APP_VERSION || "0.1.0",
    LOG_LEVEL: logLevel || "info",
    NODE_ENV: (process.env.NODE_ENV as "development" | "test" | "production") || "production",
  });
}

const severityLabel: Record<SupportDiagnosis["severity"], string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export type SupportTicketNotifier = {
  notifyTicketTriaged(
    ticket: { number: number; title: string },
    diagnosis: SupportDiagnosis,
    status: string,
    approvalRequired: boolean,
  ): Promise<void>;
};

/** Função pura — sem rede, fácil de testar isolada. */
export function formatTicketTriagedMessage(
  ticket: { number: number; title: string },
  diagnosis: SupportDiagnosis,
  status: string,
  approvalRequired: boolean,
): string {
  const linhas = [
    `GUULY concluiu a triagem do chamado #${ticket.number}`,
    ticket.title,
    `Status: ${status}`,
    `Severidade: ${severityLabel[diagnosis.severity]}`,
  ];
  if (approvalRequired) linhas.push("Precisa de aprovação do proprietário.");
  linhas.push("Veja em: /support");
  return linhas.join("\n");
}

/**
 * Chama a API do Telegram direto — sem passar por n8n/Central IA, para não
 * depender de três serviços locais só para um aviso chegar (ver
 * docs/superpowers/specs/2026-08-11-telegram-ticket-notification-design.md).
 *
 * Nunca lança: uma falha aqui não pode impedir a triagem de ser concluída.
 */
export class TelegramNotifier implements SupportTicketNotifier {
  constructor(
    private readonly botToken = process.env.TELEGRAM_BOT_TOKEN?.trim(),
    private readonly chatId = process.env.TELEGRAM_CHAT_ID?.trim(),
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async notifyTicketTriaged(
    ticket: { number: number; title: string },
    diagnosis: SupportDiagnosis,
    status: string,
    approvalRequired: boolean,
  ): Promise<void> {
    if (!this.botToken || !this.chatId) return;
    try {
      const text = formatTicketTriagedMessage(ticket, diagnosis, status, approvalRequired);
      const response = await this.fetcher(`${TELEGRAM_API_BASE}/bot${this.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: this.chatId, text }),
      });
      if (!response.ok) throw new Error(`TELEGRAM_HTTP_${response.status}`);
    } catch (error) {
      notifierLogger().warn({
        ticketNumber: ticket.number,
        errorName: error instanceof Error ? error.name : "UNKNOWN",
        errorMessage: error instanceof Error ? error.message : String(error),
      }, "Não foi possível enviar o aviso de triagem no Telegram.");
    }
  }
}
