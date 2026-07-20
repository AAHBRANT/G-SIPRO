import { getDatabase } from "../src/core/database/prisma";
import { AnalysisService } from "../src/modules/analyses/application/analysis-service";
import { PrismaAnalysisRepository } from "../src/modules/analyses/infrastructure/prisma-analysis-repository";

async function main() {
  if (!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/)) throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  const database = getDatabase();
  const [user, tender] = await Promise.all([
    database.user.findFirstOrThrow({ where: { status: "ACTIVE" } }),
    database.tender.findUniqueOrThrow({ where: { code: "ED-TESTE-I1-001" } }),
  ]);
  const requirement = await database.tenderRequirement.findFirstOrThrow({ where: { tenderVersion: { tenderId: tender.id }, type: "TECHNICAL_CAPACITY" } });
  const service = new AnalysisService(new PrismaAnalysisRepository());
  const existing = await database.requirementAnalysis.findUnique({ where: { requirementId_competence: { requirementId: requirement.id, competence: "TECHNICAL" } }, select: { id: true, status: true } });
  const analysis = existing ?? await service.create({ requirementId: requirement.id, competence: "TECHNICAL", priority: "CRITICAL", assigneeId: user.id }, user.id);
  if (analysis.status === "PENDING") await service.decide(analysis.id, { decision: "VALIDATED", justification: "Capacidade técnica validada humanamente com base na evidência indicada." }, user.id);
  const result = await database.requirementAnalysis.findUniqueOrThrow({ where: { id: analysis.id }, include: { history: true } });
  const auditEvents = await database.auditEvent.count({ where: { entityType: "REQUIREMENT_ANALYSIS", entityId: result.id } });
  console.log(JSON.stringify({ competence: result.competence, priority: result.priority, status: result.status, version: result.version, history: result.history.length, auditEvents }));
  await database.$disconnect();
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Smoke failed"); process.exitCode = 1; });
