import { getDatabase } from "../src/core/database/prisma";
import { AnalysisService } from "../src/modules/analyses/application/analysis-service";
import { PrismaAnalysisRepository } from "../src/modules/analyses/infrastructure/prisma-analysis-repository";
import { ComplianceMatrixService } from "../src/modules/compliance-matrices/application/matrix-service";
import { PrismaComplianceMatrixRepository } from "../src/modules/compliance-matrices/infrastructure/prisma-matrix-repository";
import { RequirementService } from "../src/modules/requirements/application/requirement-service";
import { PrismaRequirementRepository } from "../src/modules/requirements/infrastructure/prisma-requirement-repository";

async function main() {
  if (!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/)) throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  const database = getDatabase();
  const [actor, tender] = await Promise.all([
    database.user.findFirstOrThrow({ where: { status: "ACTIVE" } }),
    database.tender.findUniqueOrThrow({ where: { code: "ED-TESTE-I1-001" }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } }),
  ]);
  const source = tender.versions[0];
  const requirements = await database.tenderRequirement.findMany({ where: { tenderVersionId: source.id }, include: { analyses: true } });
  const analysisService = new AnalysisService(new PrismaAnalysisRepository());
  const requirementService = new RequirementService(new PrismaRequirementRepository());
  for (const requirement of requirements) {
    if (requirement.analyses.length === 0) throw new Error(`Requisito sintético sem análise humana: ${requirement.type}`);
    for (const analysis of requirement.analyses) {
      if (analysis.status === "REJECTED") throw new Error(`Análise sintética rejeitada: ${requirement.type}`);
      if (analysis.status === "PENDING") await analysisService.decide(analysis.id, { decision: "VALIDATED", justification: "Revalidação humana concluída após a retificação sintética." }, actor.id);
    }
    if (requirement.status !== "VALIDATED") await requirementService.validate(requirement.id, { justification: "Requisito validado após todas as análises humanas concluídas." }, actor.id);
  }
  const service = new ComplianceMatrixService(new PrismaComplianceMatrixRepository());
  const existing = await database.complianceMatrix.findFirst({ where: { tenderVersionId: source.id, analysisReference: "Análise sintética BL-205", version: 1 } });
  const matrix = existing ?? await service.create({ tenderVersionId: source.id, analysisReference: "Análise sintética BL-205" }, actor.id);
  const record = await database.complianceMatrix.findUniqueOrThrow({ where: { id: matrix.id }, include: { items: true, history: true } });
  let appendOnlyBlocked = false;
  try { await database.$executeRaw`UPDATE "compliance_matrix_items" SET "sourcePage" = "sourcePage" + 1 WHERE "id" = ${record.items[0].id}::uuid`; } catch { appendOnlyBlocked = true; }
  if (!appendOnlyBlocked) throw new Error("A proteção append-only dos itens da matriz falhou.");
  const audits = await database.auditEvent.count({ where: { action: "COMPLIANCE_MATRIX_CREATED", entityId: record.id } });
  const validationAudits = await database.auditEvent.count({ where: { action: "REQUIREMENT_VALIDATED", entityId: { in: requirements.map(requirement => requirement.id) } } });
  console.log(JSON.stringify({ matrix: true, status: record.status, version: record.version, itemCount: record.itemCount, items: record.items.length, requirementVersion: record.items[0]?.requirementVersion, sourceHashPreserved: record.sourceFileHash === source.fileHash, appendOnlyBlocked, history: record.history.length, audits, validationAudits }));
  await database.$disconnect();
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Smoke failed"); process.exitCode = 1; });
