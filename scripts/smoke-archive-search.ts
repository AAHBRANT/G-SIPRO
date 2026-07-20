import { getDatabase } from "../src/core/database/prisma";
import { ArchiveSearchService } from "../src/modules/technical-archive/application/archive-search-service";
import { PrismaArchiveSearchRepository } from "../src/modules/technical-archive/infrastructure/prisma-archive-search-repository";

async function main() {
  if (!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/)) throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  const database = getDatabase();
  const actor = await database.user.findFirstOrThrow({ where: { status: "ACTIVE" } });
  const service = new ArchiveSearchService(new PrismaArchiveSearchRepository());
  const byDiscipline = await service.search({ discipline: "estruturas" }, actor.id);
  const byDescription = await service.search({ service: "concreto armado" }, actor.id);
  const byCharacteristic = await service.search({ characteristic: "concreto" }, actor.id);
  const byQuantity = await service.search({ minQuantity: 1200, maxQuantity: 1300, unit: "m3" }, actor.id);
  const audits = await database.auditEvent.findMany({ where: { action: "TECHNICAL_ARCHIVE_SEARCHED", actorId: actor.id }, orderBy: { occurredAt: "desc" }, take: 4 });
  const rawTermsAbsent = audits.every(event => JSON.stringify(event.metadata).includes('"rawTermsStored":false'));
  const traceable = byQuantity.items.every(item => item.quantities.every(quantity => quantity.source) && item.evidence.fileHash.length > 0);
  console.log(JSON.stringify({ disciplineMatches: byDiscipline.total, descriptionMatches: byDescription.total, characteristicMatches: byCharacteristic.total, quantityMatches: byQuantity.total, audits: audits.length, rawTermsAbsent, traceable }));
  await database.$disconnect();
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Smoke failed"); process.exitCode = 1; });
