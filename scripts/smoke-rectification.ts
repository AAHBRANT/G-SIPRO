import { getDatabase } from "../src/core/database/prisma";
import { AnalysisService } from "../src/modules/analyses/application/analysis-service";
import { PrismaAnalysisRepository } from "../src/modules/analyses/infrastructure/prisma-analysis-repository";
import { RectificationService } from "../src/modules/rectifications/application/rectification-service";
import { PrismaRectificationRepository } from "../src/modules/rectifications/infrastructure/prisma-rectification-repository";
import { RequirementService } from "../src/modules/requirements/application/requirement-service";
import { PrismaRequirementRepository } from "../src/modules/requirements/infrastructure/prisma-requirement-repository";

async function main() {
  if (!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/)) throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  const database = getDatabase();
  const [user, tender] = await Promise.all([database.user.findFirstOrThrow({ where: { status: "ACTIVE" } }), database.tender.findUniqueOrThrow({ where: { code: "ED-TESTE-I1-001" }, include: { versions: { orderBy: { version: "asc" } } } })]);
  if (tender.versions.length < 2) throw new Error("O smoke exige duas versões documentais.");
  const latest = tender.versions.at(-1)!;
  const impactedRequirement = await database.tenderRequirement.findFirstOrThrow({ where: { tenderVersion: { tenderId: tender.id }, type: "TECHNICAL_CAPACITY" } });
  const requirementService = new RequirementService(new PrismaRequirementRepository());
  const controlRequirement = await database.tenderRequirement.findFirst({ where: { tenderVersionId: latest.id, type: "FINANCIAL_QUALIFICATION" } }) ?? await requirementService.create({ tenderVersionId: latest.id, type: "FINANCIAL_QUALIFICATION", text: "Apresentar índices financeiros exigidos no edital.", criticality: "HIGH", responsibleId: user.id, sourceExcerpt: "A licitante deverá comprovar os índices financeiros indicados.", sourcePage: 20 }, user.id);
  const analysisService = new AnalysisService(new PrismaAnalysisRepository());
  let controlAnalysis = await database.requirementAnalysis.findUnique({ where: { requirementId_competence: { requirementId: controlRequirement.id, competence: "FINANCIAL" } }, select: { id: true, status: true } });
  if (!controlAnalysis) controlAnalysis = await analysisService.create({ requirementId: controlRequirement.id, competence: "FINANCIAL", priority: "HIGH", assigneeId: user.id }, user.id);
  if (controlAnalysis!.status === "PENDING") await analysisService.decide(controlAnalysis!.id, { decision: "VALIDATED", justification: "Qualificação financeira validada humanamente para controle do smoke." }, user.id);
  let rectification = await database.tenderRectification.findUnique({ where: { rectifiedByVersionId: latest.id } });
  if (!rectification) {
    await new RectificationService(new PrismaRectificationRepository()).create({ tenderId: tender.id, previousVersionId: tender.versions[0].id, rectifiedByVersionId: latest.id, description: "Retificação sintética do requisito de capacidade técnica.", source: "Portal oficial sintético", impacts: [{ requirementId: impactedRequirement.id, description: "A capacidade técnica deve ser novamente validada após a retificação.", requiresRevalidation: true }] }, user.id);
    rectification = await database.tenderRectification.findUniqueOrThrow({ where: { rectifiedByVersionId: latest.id } });
  }
  const [impacted, control, impacts, auditEvents] = await Promise.all([
    database.requirementAnalysis.findUniqueOrThrow({ where: { requirementId_competence: { requirementId: impactedRequirement.id, competence: "TECHNICAL" } }, include: { history: true } }),
    database.requirementAnalysis.findUniqueOrThrow({ where: { requirementId_competence: { requirementId: controlRequirement.id, competence: "FINANCIAL" } }, include: { history: true } }),
    database.rectificationImpact.count({ where: { rectificationId: rectification.id } }),
    database.auditEvent.count({ where: { entityType: "TENDER_RECTIFICATION", entityId: rectification.id } }),
  ]);
  console.log(JSON.stringify({ impacts, impacted: { status: impacted.status, version: impacted.version, history: impacted.history.length }, control: { status: control.status, version: control.version, history: control.history.length }, auditEvents }));
  await database.$disconnect();
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Smoke failed"); process.exitCode = 1; });
