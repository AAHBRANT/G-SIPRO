import { createHash } from "node:crypto";
import { getDatabase } from "../src/core/database/prisma";
import { MatrixExportService } from "../src/modules/compliance-matrices/application/matrix-export-service";
import { MatrixEvidenceService } from "../src/modules/compliance-matrices/application/matrix-evidence-service";
import { PrismaMatrixExportRepository } from "../src/modules/compliance-matrices/infrastructure/prisma-matrix-export-repository";
import { PrismaMatrixEvidenceRepository } from "../src/modules/compliance-matrices/infrastructure/prisma-matrix-evidence-repository";

async function main() {
  if (!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/)) throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  const database = getDatabase();
  const actor = await database.user.findFirstOrThrow({ where: { status: "ACTIVE" } });
  const matrix = await database.complianceMatrix.findFirstOrThrow({ where: { analysisReference: "Análise sintética BL-205", version: 1 }, include: { items: true } });
  const service = new MatrixExportService(new PrismaMatrixExportRepository());
  const exported = await service.finalize(matrix.id, actor.id);
  const retried = await service.finalize(matrix.id, actor.id);
  const download = await service.download(exported.id, actor.id);
  const payload = JSON.parse(download.content) as { schemaVersion: string; source: { fileHash: string }; matrix: { id: string; version: number; status: string }; items: Array<{ evidence: unknown[]; validations: unknown[] }> };
  const computedHash = createHash("sha256").update(download.content, "utf8").digest("hex");
  let appendOnlyBlocked = false;
  try { await database.$executeRaw`UPDATE "compliance_matrix_exports" SET "fileName"='alteracao-proibida.json' WHERE "id"=${exported.id}::uuid`; } catch { appendOnlyBlocked = true; }
  let postValidationEvidenceBlocked = false;
  try {
    const evidence = await database.technicalEvidence.findFirstOrThrow();
    await new MatrixEvidenceService(new PrismaMatrixEvidenceRepository()).associate(matrix.items[0].id, { technicalEvidenceId: evidence.id, locator: "Após validação", justification: "Tentativa sintética após consolidação da matriz." }, actor.id);
  } catch { postValidationEvidenceBlocked = true; }
  const persisted = await database.complianceMatrix.findUniqueOrThrow({ where: { id: matrix.id }, include: { history: true, exports: true } });
  const audits = await database.auditEvent.count({ where: { action: { in: ["COMPLIANCE_MATRIX_VALIDATED", "COMPLIANCE_MATRIX_EXPORTED", "COMPLIANCE_MATRIX_EXPORT_DOWNLOADED"] }, OR: [{ entityId: matrix.id }, { entityId: exported.id }] } });
  console.log(JSON.stringify({ status: persisted.status, exports: persisted.exports.length, idempotent: exported.id === retried.id, formatVersion: payload.schemaVersion, matrixVersionPreserved: payload.matrix.id === matrix.id && payload.matrix.version === matrix.version && payload.matrix.status === "VALIDATED", sourceHashPreserved: payload.source.fileHash === matrix.sourceFileHash, items: payload.items.length, validationsPreserved: payload.items.every(item => item.validations.length > 0), evidencePreserved: payload.items.some(item => item.evidence.length > 0), hashVerified: computedHash === exported.fileHash, appendOnlyBlocked, postValidationEvidenceBlocked, history: persisted.history.length, audits }));
  await database.$disconnect();
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Smoke failed"); process.exitCode = 1; });

