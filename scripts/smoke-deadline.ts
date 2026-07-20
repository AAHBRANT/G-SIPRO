import { getDatabase } from "../src/core/database/prisma";
import { DeadlineService } from "../src/modules/deadlines/application/deadline-service";
import { PrismaDeadlineRepository } from "../src/modules/deadlines/infrastructure/prisma-deadline-repository";

async function main() {
  if (!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/)) {
    throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  }

  const database = getDatabase();
  const [user, tender] = await Promise.all([
    database.user.findFirstOrThrow({ where: { status: "ACTIVE" } }),
    database.tender.findUniqueOrThrow({ where: { code: "ED-TESTE-I1-001" } }),
  ]);
  const requirement = await database.tenderRequirement.findFirstOrThrow({
    where: { tenderVersion: { tenderId: tender.id }, type: "TECHNICAL_CAPACITY" },
  });
  const service = new DeadlineService(new PrismaDeadlineRepository());
  const existing = await database.tenderDeadline.findFirst({
    where: { tenderId: tender.id, event: "Entrega sintética BL-105" },
    select: { id: true, status: true },
  });
  const deadline = existing ?? await service.create({
    tenderId: tender.id,
    requirementId: requirement.id,
    event: "Entrega sintética BL-105",
    dueAt: "2026-08-15T15:00:00.000Z",
    timeZone: "America/Sao_Paulo",
    source: "Edital sintético v2, requisito TECHNICAL_CAPACITY",
    critical: true,
    responsibleId: user.id,
    alerts: ["2026-08-14T15:00:00.000Z"],
  }, user.id);
  if (deadline.status === "PENDING_CONFIRMATION") {
    await service.confirm(deadline.id, {
      reason: "Prazo conferido humanamente na versão documental sintética.",
    }, user.id);
  }

  const result = await database.tenderDeadline.findUniqueOrThrow({
    where: { id: deadline.id },
    include: { alerts: true, history: true },
  });
  const auditEvents = await database.auditEvent.count({
    where: { entityType: "TENDER_DEADLINE", entityId: result.id },
  });
  console.log(JSON.stringify({
    event: result.event,
    status: result.status,
    version: result.version,
    alerts: result.alerts.length,
    history: result.history.length,
    auditEvents,
  }));
  await database.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Smoke failed");
  process.exitCode = 1;
});
