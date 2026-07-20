import { getDatabase } from "../src/core/database/prisma";
import { ItemAssessmentService } from "../src/modules/compliance-matrices/application/item-assessment-service";
import { MatrixEvidenceService } from "../src/modules/compliance-matrices/application/matrix-evidence-service";
import { PrismaItemAssessmentRepository } from "../src/modules/compliance-matrices/infrastructure/prisma-item-assessment-repository";
import { PrismaMatrixEvidenceRepository } from "../src/modules/compliance-matrices/infrastructure/prisma-matrix-evidence-repository";

async function main() {
  if (!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/)) throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  const database = getDatabase();
  const actor = await database.user.findFirstOrThrow({ where: { status: "ACTIVE" } });
  const matrix = await database.complianceMatrix.findFirstOrThrow({ where: { analysisReference: "Análise sintética BL-205", version: 1 }, include: { items: { include: { evidenceLinks: true, assessments: true } } } });
  const evidencedItem = matrix.items.find(item => item.evidenceLinks.length > 0)!;
  const gapItem = matrix.items.find(item => item.id !== evidencedItem.id)!;
  if (!evidencedItem || !gapItem) throw new Error("Matriz sintética precisa de dois itens para o smoke BL-207.");
  if (evidencedItem.assessments.length > 0 || gapItem.assessments.length > 0) throw new Error("Smoke BL-207 já executado nessa base.");

  const assessmentService = new ItemAssessmentService(new PrismaItemAssessmentRepository());
  const first = await assessmentService.validate(evidencedItem.id, { decision: "MEETS", justification: "As três evidências sintéticas comprovam integralmente o requisito técnico." }, actor.id);
  const additionalEvidence = await database.technicalEvidence.findFirstOrThrow({ where: { complianceEvidenceLinks: { none: { matrixItemId: evidencedItem.id } } }, orderBy: [{ type: "asc" }, { version: "asc" }] });
  await new MatrixEvidenceService(new PrismaMatrixEvidenceRepository()).associate(evidencedItem.id, { technicalEvidenceId: additionalEvidence.id, locator: "Localizador sintético de revalidação", justification: "Nova evidência incorporada para exigir revalidação humana rastreável." }, actor.id);
  const evidenceAfterAddition = await database.complianceMatrixEvidence.count({ where: { matrixItemId: evidencedItem.id } });
  const revalidationRequired = first.evidenceCount !== evidenceAfterAddition;
  const dueAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const second = await assessmentService.validate(evidencedItem.id, { decision: "PARTIAL", justification: "A nova evidência revelou atendimento parcial que exige tratamento humano.", gapDescription: "Falta comprovação complementar do escopo integral exigido.", riskDescription: "A proposta pode ser inabilitada por comprovação técnica parcial.", impact: "O requisito não pode ser consolidado como integralmente atendido.", treatment: "Solicitar e revisar evidência complementar antes da consolidação.", responsibleId: actor.id, dueAt }, actor.id);

  let positiveWithoutEvidenceBlocked = false;
  try { await assessmentService.validate(gapItem.id, { decision: "MEETS", justification: "Tentativa sintética sem qualquer evidência associada." }, actor.id); } catch { positiveWithoutEvidenceBlocked = true; }
  await assessmentService.validate(gapItem.id, { decision: "DOES_NOT_MEET", justification: "Nenhuma evidência foi localizada para este requisito.", gapDescription: "Não existe evidência associada ao item da matriz.", riskDescription: "A ausência documental pode causar inabilitação da proposta.", impact: "O requisito permanece sem comprovação técnica suficiente.", treatment: "Localizar documento válido ou registrar decisão de não participação.", responsibleId: actor.id, dueAt }, actor.id);

  let appendOnlyBlocked = false;
  try { await database.$executeRaw`UPDATE "compliance_item_assessments" SET "justification"='Alteração sintética proibida' WHERE "id"=${second.id}::uuid`; } catch { appendOnlyBlocked = true; }
  const assessments = await database.complianceItemAssessment.findMany({ where: { matrixItemId: { in: [evidencedItem.id, gapItem.id] } }, orderBy: [{ matrixItemId: "asc" }, { version: "asc" }] });
  const audits = await database.auditEvent.count({ where: { action: "COMPLIANCE_ITEM_VALIDATED", entityId: { in: [evidencedItem.id, gapItem.id] } } });
  console.log(JSON.stringify({ validations: assessments.length, revalidationVersions: assessments.filter(item => item.matrixItemId === evidencedItem.id).length, revalidationRequired, latestDecision: second.decision, positiveWithoutEvidenceBlocked, completeGapTreatment: assessments.some(item => item.matrixItemId === gapItem.id && item.gapDescription && item.riskDescription && item.impact && item.treatment && item.responsibleId && item.dueAt), appendOnlyBlocked, audits, snapshotsPreserved: assessments.every(item => Array.isArray(item.evidenceSnapshot) && item.evidenceSnapshot.length === item.evidenceCount) }));
  await database.$disconnect();
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Smoke failed"); process.exitCode = 1; });

