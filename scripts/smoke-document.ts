import { getDatabase } from "../src/core/database/prisma";
import { DocumentService } from "../src/modules/documents/application/document-service";
import { PrismaDocumentRepository } from "../src/modules/documents/infrastructure/prisma-document-repository";

async function main() {
  if (!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/)) throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  const database = getDatabase();
  const [user, tender] = await Promise.all([database.user.findFirstOrThrow({ where: { status: "ACTIVE" } }), database.tender.findUniqueOrThrow({ where: { code: "ED-TESTE-I1-001" } })]);
  const service = new DocumentService(new PrismaDocumentRepository());
  let document = await database.managedDocument.findFirst({ where: { title: "Documento sintético BL-108" }, select: { id: true } });
  if (!document) document = await service.create({ type: "EDITAL_COMPLEMENTAR", title: "Documento sintético BL-108", classification: "CONFIDENTIAL_TECHNICAL", status: "DRAFT", ownerId: user.id }, user.id);
  const existingVersions = await database.managedDocumentVersion.count({ where: { documentId: document.id } });
  if (existingVersions < 1) await service.addVersion(document.id, { uri: "https://sharepoint.example.test/gsipro/bl108-v1.pdf", fileHash: "1".repeat(64), mimeType: "application/pdf", sizeBytes: 1024, origin: "Repositório documental sintético" }, user.id);
  if (existingVersions < 2) await service.addVersion(document.id, { uri: "https://sharepoint.example.test/gsipro/bl108-v2.pdf", fileHash: "2".repeat(64), mimeType: "application/pdf", sizeBytes: 2048, origin: "Repositório documental sintético" }, user.id);
  const existingLink = await database.managedDocumentLink.findFirst({ where: { documentId: document.id, entityType: "TENDER", entityId: tender.id, role: "SUPPORTING_DOCUMENT" } });
  if (!existingLink) await service.addLink(document.id, { entityType: "TENDER", entityId: tender.id, role: "SUPPORTING_DOCUMENT" }, user.id);
  const result = await database.managedDocument.findUniqueOrThrow({ where: { id: document.id }, include: { versions: true, links: true } });
  const auditEvents = await database.auditEvent.count({ where: { entityType: "MANAGED_DOCUMENT", entityId: result.id } });
  console.log(JSON.stringify({ type: result.type, classification: result.classification, versions: result.versions.length, uniqueHashes: new Set(result.versions.map((version) => version.fileHash)).size, links: result.links.length, auditEvents }));
  await database.$disconnect();
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Smoke failed"); process.exitCode = 1; });
