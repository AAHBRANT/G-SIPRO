import { randomUUID } from "node:crypto";

import { getDatabase } from "../src/core/database/prisma";
import { SupportTriageService } from "../src/modules/support/application/support-triage-service";
import { CentralIaSupportProvider } from "../src/modules/support/infrastructure/central-ia-support-provider";
import type { SupportDiagnosis } from "../src/modules/support/domain/support-ticket";
import type { SupportTicketNotifier } from "../src/modules/support/infrastructure/telegram-notifier";

async function main() {
  if (!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/)) throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  const database = getDatabase();
  const user = await database.user.findFirstOrThrow({ where: { status: "ACTIVE" } });
  const ticket = await database.supportTicket.create({
    data: {
      type: "BUG",
      title: "Chamado sintético — smoke de notificação no Telegram",
      description: "Criado pelo smoke test; não representa um problema real.",
      reporterId: user.id,
      correlationId: randomUUID(),
    },
  });

  const chamadas: { ticketNumber: number; status: string; approvalRequired: boolean; severity: SupportDiagnosis["severity"] }[] = [];
  const notifierFalso: SupportTicketNotifier = {
    async notifyTicketTriaged(ticketArg, diagnosis, status, approvalRequired) {
      chamadas.push({ ticketNumber: ticketArg.number, status, approvalRequired, severity: diagnosis.severity });
    },
  };

  // baseUrl="" força CENTRAL_IA_NOT_CONFIGURED, cai no fallbackDiagnosis — determinístico e rápido.
  const service = new SupportTriageService(new CentralIaSupportProvider(""), notifierFalso);
  const outcome = await service.triageTicket(ticket.id, randomUUID());
  if (!outcome) throw new Error("A triagem não aplicou (o chamado já estava triado?).");
  if (chamadas.length !== 1) throw new Error(`O notificador deveria ter sido chamado 1 vez; foi chamado ${chamadas.length}.`);

  console.log(JSON.stringify({ outcomeStatus: outcome.status, notifierCalls: chamadas.length, notifierPayload: chamadas[0] }));
  await database.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Smoke falhou");
  process.exitCode = 1;
});
