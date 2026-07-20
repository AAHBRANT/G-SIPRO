import { getDatabase } from "../src/core/database/prisma";
import { TechnicalEvidenceService } from "../src/modules/technical-archive/application/technical-evidence-service";
import { PrismaTechnicalEvidenceRepository } from "../src/modules/technical-archive/infrastructure/prisma-technical-evidence-repository";

async function main() {
  if (!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/)) throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  const database = getDatabase();
  const [actor, experience, documentVersions] = await Promise.all([
    database.user.findFirstOrThrow({ where: { status: "ACTIVE" } }),
    database.executedContract.findUniqueOrThrow({ where: { code: "EXP-TESTE-I2-001" } }),
    database.managedDocumentVersion.findMany({ orderBy: [{ createdAt: "desc" }, { version: "desc" }], take: 2 }),
  ]);
  if (documentVersions.length === 0) throw new Error("Nenhuma versão documental disponível.");
  const service = new TechnicalEvidenceService(new PrismaTechnicalEvidenceRepository());
  async function initial(type: "ATTESTATION" | "CAT" | "ART", number: string, extra: Record<string, unknown> = {}): Promise<{ id: string; type: string; number: string; version: number; status: string }> {
    const existing = await database.technicalEvidence.findUnique({ where: { type_number_version: { type, number, version: 1 } } });
    if (existing) return existing;
    return service.create({ experienceId: experience.id, type, number, issuingBody: type === "ATTESTATION" ? "Cliente Sintético" : "CREA-SP", issuedAt: "2025-01-10", validUntil: "2027-01-10", status: "CURRENT", subjectActivity: type === "ATTESTATION" ? "Comprovação da execução de estrutura de concreto" : "Responsabilidade técnica por estrutura de concreto", professionalName: type === "ATTESTATION" ? undefined : "Profissional Sintético", professionalIdentifier: type === "ATTESTATION" ? undefined : "CREA 000000", startedAt: type === "ATTESTATION" ? undefined : "2024-01-01", endedAt: type === "ATTESTATION" ? undefined : "2024-12-31", documentVersionId: documentVersions[0].id, ...extra }, actor.id);
  }
  const attestation = await initial("ATTESTATION", "ATEST-TESTE-I2-001");
  const catV1 = await initial("CAT", "CAT-TESTE-I2-001");
  const art = await initial("ART", "ART-TESTE-I2-001", { relatedCatId: catV1.id });
  const existingCatV2 = await database.technicalEvidence.findUnique({ where: { type_number_version: { type: "CAT", number: "CAT-TESTE-I2-001", version: 2 } } });
  const catV2 = existingCatV2 ?? await service.create({ experienceId: experience.id, type: "CAT", number: "CAT-TESTE-I2-001", issuingBody: "CREA-SP", issuedAt: "2025-02-01", validUntil: "2027-02-01", status: "CURRENT", subjectActivity: "Responsabilidade técnica por estrutura de concreto — versão retificada", professionalName: "Profissional Sintético", professionalIdentifier: "CREA 000000", startedAt: "2024-01-01", endedAt: "2024-12-31", documentVersionId: documentVersions.at(-1)?.id ?? documentVersions[0].id, previousVersionId: catV1.id }, actor.id);
  const ids = [attestation.id, catV1.id, art.id, catV2.id];
  const [records, links, auditEvents] = await Promise.all([
    database.technicalEvidence.findMany({ where: { id: { in: ids } }, orderBy: [{ type: "asc" }, { version: "asc" }] }),
    database.managedDocumentLink.count({ where: { entityType: "TECHNICAL_EVIDENCE", entityId: { in: ids } } }),
    database.auditEvent.count({ where: { entityType: "TECHNICAL_EVIDENCE", entityId: { in: ids } } }),
  ]);
  console.log(JSON.stringify({ records: records.length, attestation: records.filter(item => item.type === "ATTESTATION").length, cats: records.filter(item => item.type === "CAT").length, arts: records.filter(item => item.type === "ART").length, catVersions: records.filter(item => item.type === "CAT").map(item => item.version), artRelatedToCat: records.find(item => item.type === "ART")?.relatedCatId === catV1.id, links, auditEvents }));
  await database.$disconnect();
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Smoke failed"); process.exitCode = 1; });
