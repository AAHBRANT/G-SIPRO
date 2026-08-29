/**
 * Verificação da leitura do acervo e do confronto, contra o PostgreSQL de
 * verdade.
 *
 * Não faz parte da suíte — a suíte roda sem banco. O que ela prova e o teste com
 * dublê não consegue: que a travessia documento → versão → evidência →
 * experiência → serviços existe de fato, e que o valor Decimal chega como
 * número.
 *
 * Uso, com o Postgres descartável no ar em 5433:
 *   DATABASE_URL=... ./node_modules/.bin/tsx scripts/verificar-acervo-fila.mts
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { computeArchiveAdherence } from "../src/modules/scouting/domain/archive-adherence.js";
import { PrismaArchiveEvidenceRepository } from "../src/modules/scouting/infrastructure/prisma-scouting-repository.js";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const casos: Array<{ nome: string; ok: boolean; detalhe: string }> = [];
const checar = (nome: string, ok: boolean, detalhe = "") => { casos.push({ nome, ok, detalhe }); };

async function main(): Promise<void> {
  const marca = `acervo-${Date.now()}`;
  const autoria = crypto.randomUUID();

  const dono = await db.user.create({
    data: { entraObjectId: crypto.randomUUID(), displayName: "Conferência", email: `${marca}@exemplo.invalido`, createdBy: autoria, updatedBy: autoria },
  });
  const documento = await db.managedDocument.create({
    data: { type: "ATESTADO", title: `Atestado ${marca}`, classification: "INTERNO", ownerId: dono.id, createdBy: dono.id, updatedBy: dono.id },
  });
  const versao = await db.managedDocumentVersion.create({
    data: {
      documentId: documento.id, version: 1, uri: `local://${marca}`, fileHash: "2".repeat(64),
      mimeType: "application/pdf", sizeBytes: BigInt(2048), origin: "conferência", createdBy: dono.id,
    },
  });
  const contrato = await db.executedContract.create({
    data: {
      code: `${marca}-c1`, contractorName: "CONTRATANTE", contractorSource: "conferência",
      subject: "Duplicação de rodovia estadual", startedAt: new Date("2022-01-01"), endedAt: new Date("2024-01-01"),
      value: 62_000_000, currency: "BRL", status: "VALIDATED", ownerId: dono.id,
      evidenceDocumentVersionId: versao.id, createdBy: dono.id, updatedBy: dono.id,
    },
  });
  for (const [disciplina, descricao] of [
    ["Terraplenagem", `Escavação e aterro compactado ${marca}`],
    ["Pavimentação asfáltica", `Revestimento em CBUQ ${marca}`],
  ] as const) {
    await db.executedService.create({
      data: { contractId: contrato.id, discipline: disciplina, originalDescription: descricao, characteristics: "", createdBy: dono.id },
    });
  }
  await db.technicalEvidence.create({
    data: {
      experience: { connect: { id: contrato.id } }, type: "ATTESTATION", number: `${marca}-n1`, issuingBody: "CREA",
      issuedAt: new Date("2024-02-01"), subjectActivity: "Obras rodoviárias",
      documentVersion: { connect: { id: versao.id } }, correlationId: crypto.randomUUID(),
      createdBy: { connect: { id: dono.id } },
    },
  });

  const acervo = await new PrismaArchiveEvidenceRepository().loadEvidence();
  const meus = acervo.filter((e) => e.description.includes(marca));

  checar("a travessia até os serviços do atestado funciona", meus.length === 2, `${meus.length} de 2`);
  checar("disciplina e descrição vieram juntas",
    meus.some((e) => e.discipline === "Pavimentação asfáltica" && e.description.includes("CBUQ")),
    meus.map((e) => e.discipline).join(" | "));
  checar("o valor do contrato chega como número, não como Decimal",
    meus.every((e) => typeof e.contractValue === "number" && e.contractValue === 62_000_000),
    `${typeof meus[0]?.contractValue} ${meus[0]?.contractValue}`);
  checar("o objeto do contrato acompanha o serviço",
    meus.every((e) => e.contractSubject === "Duplicação de rodovia estadual"));

  /* O confronto, usando só o que este roteiro semeou. */
  const cobre = computeArchiveAdherence({ sources: ["Terraplenagem e pavimentação asfáltica da rodovia"], estimatedValue: 30_000_000, inferred: true }, meus);
  checar("objeto coberto e porte alcançado dá nota cheia", cobre.score === 100 && !cobre.needsPartner, `${cobre.score}% · consórcio: ${cobre.needsPartner}`);

  const falta = computeArchiveAdherence({ sources: ["Construção de ponte e terraplenagem de acesso"], inferred: true }, meus);
  checar("objeto com serviço faltando indica consórcio", falta.needsPartner && falta.missing.some((m) => m.label === "Obra de arte especial"),
    falta.missing.map((m) => m.label).join(", "));
  checar("e a nota reflete a fração coberta", falta.score > 0 && falta.score < 80, `${falta.score}%`);

  const grande = computeArchiveAdherence({ sources: ["Pavimentação asfáltica"], estimatedValue: 300_000_000, inferred: true }, meus);
  checar("obra muito maior que o executado também indica consórcio", grande.scale === "BELOW" && grande.needsPartner, `${grande.score}% · ${grande.scale}`);

  /* Sem limpeza, de propósito. O banco tem trava de somente-acréscimo sobre
     documento e evidência técnica — e está certo: acervo não se apaga. Tentar
     remover aqui derrubava a verificação DEPOIS de todos os casos passarem.
     O rastro fica no banco descartável, que existe exatamente para isso. */
}

let estouro: unknown;
try {
  await main();
} catch (erro) {
  estouro = erro;
} finally {
  await db.$disconnect();
}

let falhas = 0;
for (const c of casos) {
  if (!c.ok) falhas += 1;
  console.log(`${c.ok ? "  ok  " : " FALHA"} ${c.nome}${c.detalhe ? "  — " + c.detalhe : ""}`);
}
console.log(`\n${casos.length - falhas}/${casos.length} passaram`);
if (estouro) console.error("\ninterrompida por erro:", estouro instanceof Error ? estouro.message : estouro);
process.exit(falhas || estouro ? 1 : 0);
