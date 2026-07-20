import { getDatabase } from "../src/core/database/prisma";
import { ProfessionalService } from "../src/modules/technical-archive/application/professional-service";
import { PrismaProfessionalRepository } from "../src/modules/technical-archive/infrastructure/prisma-professional-repository";

async function main() {
  if (!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/)) throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  const database = getDatabase();
  const actor = await database.user.findFirstOrThrow({ where: { status: "ACTIVE" } });
  const cat = await database.technicalEvidence.findFirstOrThrow({ where: { type: "CAT", number: "CAT-TESTE-I2-001" }, orderBy: { version: "desc" } });
  const art = await database.technicalEvidence.findFirstOrThrow({ where: { type: "ART", number: "ART-TESTE-I2-001" }, orderBy: { version: "desc" } });
  const service = new ProfessionalService(new PrismaProfessionalRepository());
  let professional: { id: string } | null = await database.professional.findUnique({ where: { council_registrationNumber: { council: "CREA-SP", registrationNumber: "000000" } }, select: { id: true } });
  if (!professional) professional = await service.create({ fullName: "Profissional Sintético", council: "CREA-SP", registrationNumber: "000000", nationalRegistration: "2600000000", professionalTitle: "Engenheiro Civil", status: "ACTIVE", processingPurpose: "Comprovar capacidade técnico-profissional em propostas do cenário sintético.", legalBasis: "Execução de contrato e procedimentos preliminares relacionados", links: [
    { targetType: "TECHNICAL_EVIDENCE", targetId: cat.id, role: "Responsável técnico", responsibility: "Responsabilidade técnica registrada na CAT", startedAt: "2024-01-01", endedAt: "2024-12-31", source: "CAT sintética do BL-202", evidenceDocumentVersionId: cat.documentVersionId },
    { targetType: "TECHNICAL_EVIDENCE", targetId: art.id, role: "Responsável técnico", responsibility: "Atividade técnica registrada na ART", startedAt: "2024-01-01", endedAt: "2024-12-31", source: "ART sintética do BL-202", evidenceDocumentVersionId: art.documentVersionId },
  ] }, actor.id);
  const listed = await service.list(actor.id);
  const professionalLinkIds = (await database.professionalLink.findMany({ where: { professionalId: professional.id }, select: { id: true } })).map(item => item.id);
  const links = await database.professionalLink.count({ where: { professionalId: professional.id } });
  const history = await database.professionalHistory.count({ where: { professionalId: professional.id } });
  const documentLinks = await database.managedDocumentLink.count({ where: { entityType: "PROFESSIONAL_LINK", entityId: { in: professionalLinkIds } } });
  const creationAudits = await database.auditEvent.count({ where: { action: "PROFESSIONAL_CREATED", entityId: professional.id } });
  const accessAudits = await database.auditEvent.count({ where: { action: "PROFESSIONAL_DATA_ACCESSED" } });
  console.log(JSON.stringify({ professional: listed.some(item => item.id === professional.id), classification: listed.find(item => item.id === professional.id)?.classification, links, history, documentLinks, creationAudits, accessAudits }));
  await database.$disconnect();
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Smoke failed"); process.exitCode = 1; });
