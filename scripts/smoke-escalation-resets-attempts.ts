import { randomUUID } from "node:crypto";

import { getDatabase } from "../src/core/database/prisma";
import { resolveOwnerEscalation } from "../src/app/api/support/tickets/[id]/escalation/route";

async function main() {
  if (!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/)) throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  const database = getDatabase();
  const user = await database.user.findFirstOrThrow({ where: { status: "ACTIVE" } });

  const ticket = await database.supportTicket.create({
    data: {
      type: "BUG",
      title: "Chamado sintético — smoke de reset de tentativas na escalação",
      description: "Criado pelo smoke test; não representa um problema real.",
      reporterId: user.id,
      status: "ESCALATED",
      executionAttempts: 3,
      executorId: null,
      executionLeaseId: null,
      correlationId: randomUUID(),
    },
  });

  const result = await resolveOwnerEscalation({ database, actorId: user.id, ticketId: ticket.id, note: undefined, correlationId: randomUUID() });
  if (result.status !== "IN_PROGRESS") throw new Error(`Status esperado IN_PROGRESS, veio ${result.status}.`);

  const updated = await database.supportTicket.findUniqueOrThrow({ where: { id: ticket.id }, select: { executionAttempts: true, executorId: true, executionLeaseId: true } });
  if (updated.executionAttempts !== 0) throw new Error(`executionAttempts deveria ser 0 após o proprietário assumir o chamado escalado; veio ${updated.executionAttempts}.`);
  if (updated.executorId !== "proprietario") throw new Error(`executorId deveria ser "proprietario"; veio ${updated.executorId}.`);
  if (updated.executionLeaseId !== null) throw new Error("executionLeaseId deveria ser null.");

  console.log(JSON.stringify({ cenario: "escalated", status: result.status, executionAttempts: updated.executionAttempts }));

  // Sem regressão: o outro ramo (confirmar ação externa) já zerava as tentativas antes desta
  // correção e precisa continuar assim — aqui a diferença é status final e executorId nulo.
  const ownerActionTicket = await database.supportTicket.create({
    data: {
      type: "BUG",
      title: "Chamado sintético — smoke de confirmação de ação externa",
      description: "Criado pelo smoke test; não representa um problema real.",
      reporterId: user.id,
      status: "OWNER_ACTION_REQUIRED",
      executionAttempts: 2,
      executorId: null,
      executionLeaseId: null,
      correlationId: randomUUID(),
    },
  });
  const ownerActionResult = await resolveOwnerEscalation({ database, actorId: user.id, ticketId: ownerActionTicket.id, note: "Permissão concedida no portal externo.", correlationId: randomUUID() });
  if (ownerActionResult.status !== "TRIAGED") throw new Error(`Status esperado TRIAGED, veio ${ownerActionResult.status}.`);
  const ownerActionUpdated = await database.supportTicket.findUniqueOrThrow({ where: { id: ownerActionTicket.id }, select: { executionAttempts: true, executorId: true } });
  if (ownerActionUpdated.executionAttempts !== 0) throw new Error(`executionAttempts deveria ser 0 após confirmar ação externa; veio ${ownerActionUpdated.executionAttempts}.`);
  if (ownerActionUpdated.executorId !== null) throw new Error(`executorId deveria ser null; veio ${ownerActionUpdated.executorId}.`);
  console.log(JSON.stringify({ cenario: "owner_action_required", status: ownerActionResult.status, executionAttempts: ownerActionUpdated.executionAttempts }));

  await database.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Smoke falhou");
  process.exitCode = 1;
});
