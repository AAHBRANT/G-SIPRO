import { getDatabase } from "../src/core/database/prisma";
import { ExperienceService } from "../src/modules/technical-archive/application/experience-service";
import { PrismaExperienceRepository } from "../src/modules/technical-archive/infrastructure/prisma-experience-repository";

async function main() {
  if (!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/)) throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  const database = getDatabase();
  const [user, evidence] = await Promise.all([database.user.findFirstOrThrow({ where: { status: "ACTIVE" } }), database.managedDocumentVersion.findFirstOrThrow({ orderBy: { version: "desc" } })]);
  let experience = await database.executedContract.findUnique({ where: { code: "EXP-TESTE-I2-001" }, select: { id: true } });
  if (!experience) experience = await new ExperienceService(new PrismaExperienceRepository()).create({
    code: "EXP-TESTE-I2-001", contractorName: "Órgão Contratante Sintético", contractorIdentifier: "00.000.000/0001-00", contractorSource: "Contrato sintético e versão documental comprobatória", subject: "Execução de estrutura em concreto armado", startedAt: "2024-01-01", endedAt: "2024-12-31", value: 1500000, currency: "BRL", ownerId: user.id, evidenceDocumentVersionId: evidence.id,
    work: { name: "Obra Sintética I2", location: "São Paulo/SP", type: "INFRAESTRUTURA", startedAt: "2024-02-01", endedAt: "2024-11-30", characteristics: "Estrutura em concreto armado com controle tecnológico" },
    services: [{ discipline: "ESTRUTURAS", originalDescription: "Execução de estruturas de concreto armado moldadas in loco", characteristics: "Concreto estrutural", quantities: [{ value: 1250.5, unit: "m3", source: "Planilha de medição sintética" }] }],
  }, user.id);
  const result = await database.executedContract.findUniqueOrThrow({ where: { id: experience.id }, include: { works: true, services: { include: { quantities: true } }, history: true, evidenceDocumentVersion: { include: { document: { include: { links: true } } } } } });
  const auditEvents = await database.auditEvent.count({ where: { entityType: "EXECUTED_CONTRACT", entityId: result.id } });
  const evidenceLinks = result.evidenceDocumentVersion.document.links.filter((link) => link.entityType === "EXECUTED_CONTRACT" && link.entityId === result.id).length;
  console.log(JSON.stringify({ code: result.code, status: result.status, version: result.version, works: result.works.length, services: result.services.length, quantities: result.services.reduce((sum, service) => sum + service.quantities.length, 0), history: result.history.length, evidenceLinks, auditEvents }));
  await database.$disconnect();
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Smoke failed"); process.exitCode = 1; });
