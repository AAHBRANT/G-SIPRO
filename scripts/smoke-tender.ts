import { createHash } from "node:crypto";

import { getDatabase } from "../src/core/database/prisma";
import { TenderService } from "../src/modules/tenders/application/tender-service";
import { PrismaTenderRepository } from "../src/modules/tenders/infrastructure/prisma-tender-repository";

async function main() {
  if (!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/)) {
    throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  }
  const database = getDatabase();
  const users = await database.user.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  if (users.length !== 1) throw new Error("O smoke exige exatamente um usuário ativo.");
  const actorId = users[0].id;
  const service = new TenderService(new PrismaTenderRepository());
  let tender = await database.tender.findUnique({ where: { code: "ED-TESTE-I1-001" }, include: { versions: true } });

  if (!tender) {
    const created = await service.create({
      tender: {
        code: "ED-TESTE-I1-001",
        number: "TESTE-001/2026",
        modality: "Teste controlado",
        subject: "Edital sintético para validação do BL-103",
        origin: "Roteiro local de smoke BL-103",
        lots: [{ code: "L1", subject: "Lote sintético" }],
      },
      version: {
        fileName: "edital-sintetico-v1.pdf",
        fileHash: createHash("sha256").update("GSIPRO BL103 V1").digest("hex"),
        uri: `gsipro://documents/sha256/${createHash("sha256").update("GSIPRO BL103 V1").digest("hex")}`,
        mimeType: "application/pdf",
        sizeBytes: 15,
        source: "Roteiro local de smoke BL-103",
        receivedAt: new Date(),
        attachments: [],
      },
    }, actorId);
    tender = await database.tender.findUniqueOrThrow({ where: { id: created.id }, include: { versions: true } });
  }

  if (tender.versions.length === 1) {
    await service.addVersion(tender.id, {
      fileName: "edital-sintetico-v2.pdf",
      fileHash: createHash("sha256").update("GSIPRO BL103 V2").digest("hex"),
      uri: `gsipro://documents/sha256/${createHash("sha256").update("GSIPRO BL103 V2").digest("hex")}`,
      mimeType: "application/pdf",
      sizeBytes: 15,
      source: "Roteiro local de smoke BL-103 - retificação sintética",
      receivedAt: new Date(),
      attachments: [],
    }, actorId);
  }

  const result = await database.tender.findUniqueOrThrow({ where: { id: tender.id }, include: { versions: true, lots: true } });
  const auditCount = await database.auditEvent.count({ where: { entityType: "TENDER", entityId: tender.id } });
  console.log(JSON.stringify({ code: result.code, versions: result.versions.length, lots: result.lots.length, auditEvents: auditCount }));
  await database.$disconnect();
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Smoke failed"); process.exitCode = 1; });
