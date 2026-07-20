import { getDatabase } from "../src/core/database/prisma";
import { RequirementService } from "../src/modules/requirements/application/requirement-service";
import { PrismaRequirementRepository } from "../src/modules/requirements/infrastructure/prisma-requirement-repository";

async function main() {
  if (!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/)) throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  const database = getDatabase();
  const [user, tender] = await Promise.all([
    database.user.findFirstOrThrow({ where: { status: "ACTIVE" } }),
    database.tender.findUniqueOrThrow({ where: { code: "ED-TESTE-I1-001" }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } }),
  ]);
  const service = new RequirementService(new PrismaRequirementRepository());
  const existing = await database.tenderRequirement.findFirst({
    where: { tenderVersionId: tender.versions[0].id, type: "TECHNICAL_CAPACITY" },
    select: { id: true, version: true },
  });
  const requirement = existing ?? await service.create({
    tenderVersionId: tender.versions[0].id,
    type: "TECHNICAL_CAPACITY",
    text: "Apresentar atestado de capacidade técnica compatível com o objeto.",
    criticality: "CRITICAL",
    responsibleId: user.id,
    sourceExcerpt: "A licitante deverá apresentar atestado de capacidade técnica compatível.",
    sourcePage: 12,
  }, user.id);
  if (requirement.version === 1) await service.update(requirement.id, { sourcePage: 13 }, user.id);
  const result = await database.tenderRequirement.findUniqueOrThrow({ where: { id: requirement.id }, include: { history: true } });
  const auditEvents = await database.auditEvent.count({ where: { entityType: "TENDER_REQUIREMENT", entityId: requirement.id } });
  console.log(JSON.stringify({ type: result.type, sourcePage: result.sourcePage, version: result.version, history: result.history.length, auditEvents }));
  await database.$disconnect();
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Smoke failed"); process.exitCode = 1; });
