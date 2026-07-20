import { getDatabase } from "../src/core/database/prisma";
import { MatrixEvidenceService } from "../src/modules/compliance-matrices/application/matrix-evidence-service";
import { PrismaMatrixEvidenceRepository } from "../src/modules/compliance-matrices/infrastructure/prisma-matrix-evidence-repository";

async function main() {
  if (!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/)) throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  const database = getDatabase();
  const actor = await database.user.findFirstOrThrow({ where: { status: "ACTIVE" } });
  const matrix = await database.complianceMatrix.findFirstOrThrow({ where: { analysisReference: "Análise sintética BL-205", version: 1 }, include: { items: true } });
  const item = matrix.items.find(candidate => candidate.requirementType === "TECHNICAL_CAPACITY") ?? matrix.items[0];
  const [attestation, cat, art] = await Promise.all([
    database.technicalEvidence.findFirstOrThrow({ where: { type: "ATTESTATION", number: "ATEST-TESTE-I2-001" }, orderBy: { version: "desc" } }),
    database.technicalEvidence.findFirstOrThrow({ where: { type: "CAT", number: "CAT-TESTE-I2-001" }, orderBy: { version: "desc" } }),
    database.technicalEvidence.findFirstOrThrow({ where: { type: "ART", number: "ART-TESTE-I2-001" }, orderBy: { version: "desc" } }),
  ]);
  const quantity = await database.executedQuantity.findFirstOrThrow({ where: { service: { contractId: cat.experienceId } } });
  const service = new MatrixEvidenceService(new PrismaMatrixEvidenceRepository());
  async function associate(evidenceId: string, input: Record<string, unknown>) {
    const existing = await database.complianceMatrixEvidence.findUnique({ where: { matrixItemId_technicalEvidenceId: { matrixItemId: item.id, technicalEvidenceId: evidenceId } } });
    return existing ?? service.associate(item.id, { technicalEvidenceId: evidenceId, ...input }, actor.id);
  }
  await associate(attestation.id, { locator: "Página sintética 1", justification: "Atestado comprova a execução da experiência sintética." });
  await associate(cat.id, { locator: "Página sintética 2", justification: "CAT comprova a responsabilidade e o quantitativo executado.", comparisons: [{ executedQuantityId: quantity.id, requiredValue: 1000, requiredUnit: quantity.unit }] });
  await associate(art.id, { locator: "Página sintética 3", justification: "ART complementa a comprovação com conversão documentada.", comparisons: [{ executedQuantityId: quantity.id, requiredValue: 1_000_000, requiredUnit: "L", conversionFactor: 1000, conversionRule: "Converter metros cúbicos para litros multiplicando por mil.", conversionSource: "Regra métrica documentada no smoke BL-206" }] });
  let duplicateBlocked = false;
  try { await service.associate(item.id, { technicalEvidenceId: cat.id, locator: "Duplicado", justification: "Tentativa sintética de duplicação da mesma evidência." }, actor.id); } catch { duplicateBlocked = true; }
  const links = await database.complianceMatrixEvidence.findMany({ where: { matrixItemId: item.id }, include: { comparisons: true } });
  let appendOnlyBlocked = false;
  try { await database.$executeRaw`UPDATE "compliance_quantity_comparisons" SET "requiredValue"="requiredValue"+1 WHERE "evidenceAssociationId" IN (SELECT "id" FROM "compliance_matrix_evidence" WHERE "matrixItemId"=${item.id}::uuid)`; } catch { appendOnlyBlocked = true; }
  const comparisons = links.flatMap(link => link.comparisons);
  const audits = await database.auditEvent.count({ where: { action: "MATRIX_EVIDENCE_ASSOCIATED", entityId: item.id } });
  console.log(JSON.stringify({ evidenceLinks: links.length, comparisons: comparisons.length, documentedConversions: comparisons.filter(comparison => comparison.conversionFactor !== null).length, sameUnitDifference: comparisons.find(comparison => comparison.conversionFactor === null)?.difference.toString(), duplicateBlocked, appendOnlyBlocked, audits, hashesPreserved: links.every(link => link.evidenceFileHash.length === 64) }));
  await database.$disconnect();
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Smoke failed"); process.exitCode = 1; });
