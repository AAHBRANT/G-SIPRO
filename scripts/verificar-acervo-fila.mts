/**
 * Verificação da aderência de acervo contra o PostgreSQL de verdade.
 *
 * Não faz parte da suíte — a suíte roda sem banco. O que ela prova e o teste
 * com dublê não consegue: que a consulta atravessa as relações certas, que só
 * contrato VALIDADO entra no acervo, e que o valor Decimal chega como número.
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
    data: { entraObjectId: crypto.randomUUID(), displayName: "Conferência acervo", email: `${marca}@exemplo.invalido`, createdBy: autoria, updatedBy: autoria },
  });
  const documento = await db.managedDocument.create({
    data: {
      type: "ATESTADO", title: `Atestado ${marca}`, classification: "INTERNO",
      ownerId: dono.id, createdBy: dono.id, updatedBy: dono.id,
    },
  });
  const versao = await db.managedDocumentVersion.create({
    data: {
      documentId: documento.id, version: 1, uri: `local://${marca}`, fileHash: "0".repeat(64),
      mimeType: "application/pdf", sizeBytes: BigInt(1024), origin: "conferência", createdBy: dono.id,
    },
  });

  const criarContrato = async (codigo: string, status: "VALIDATED" | "DRAFT", valor: number) =>
    db.executedContract.create({
      data: {
        code: `${marca}-${codigo}`, contractorName: "ÓRGÃO", contractorSource: "conferência",
        subject: "Duplicação de rodovia estadual", startedAt: new Date("2023-01-01"), endedAt: new Date("2024-01-01"),
        value: valor, currency: "BRL", status, ownerId: dono.id, evidenceDocumentVersionId: versao.id,
        createdBy: dono.id, updatedBy: dono.id,
      },
    });

  const validado = await criarContrato("val", "VALIDATED", 62_000_000);
  const rascunho = await criarContrato("dra", "DRAFT", 900_000_000);

  await db.executedService.create({
    data: { contractId: validado.id, discipline: "Pavimentação asfáltica", originalDescription: `Revestimento em CBUQ ${marca}`, characteristics: "espessura 5 cm", createdBy: dono.id },
  });
  await db.executedService.create({
    data: { contractId: rascunho.id, discipline: "Pavimentação asfáltica", originalDescription: `Base e sub-base ${marca}`, characteristics: "", createdBy: dono.id },
  });

  const acervoCompleto = await new PrismaArchiveEvidenceRepository().loadValidatedEvidence();

  // A verificação olha os PRÓPRIOS registros, não o total do banco: presumir
  // banco vazio faz o roteiro quebrar assim que alguém semear qualquer coisa.
  const meuValidado = acervoCompleto.find((e) => e.description === `Revestimento em CBUQ ${marca}`);
  const meuRascunho = acervoCompleto.find((e) => e.description === `Base e sub-base ${marca}`);

  checar("o serviço do contrato validado entra no acervo", meuValidado !== undefined);
  checar("o serviço do contrato em rascunho NÃO entra", meuRascunho === undefined);
  checar("o valor do contrato chega como número, não como Decimal",
    typeof meuValidado?.contractValue === "number" && meuValidado?.contractValue === 62_000_000,
    `${typeof meuValidado?.contractValue} ${meuValidado?.contractValue}`);
  checar("disciplina, descrição e características vieram juntas",
    meuValidado?.discipline === "Pavimentação asfáltica" && meuValidado?.characteristics === "espessura 5 cm",
    `${meuValidado?.discipline} · ${meuValidado?.characteristics}`);

  // O confronto usa só o que este roteiro semeou, para a nota não depender do
  // que houver no banco.
  const acervo = meuValidado ? [meuValidado] : [];

  // O confronto de ponta a ponta, com o acervo lido do banco.
  const cabe = computeArchiveAdherence({ workTypes: ["PAVING"], estimatedValue: 30_000_000, inferred: true }, acervo);
  checar("obra menor que o já executado sai como porte coberto", cabe.determined && cabe.scale === "COVERED" && cabe.score === 100, `${cabe.score}% · ${cabe.scale}`);

  const grande = computeArchiveAdherence({ workTypes: ["PAVING"], estimatedValue: 200_000_000, inferred: true }, acervo);
  checar("obra muito maior que o executado desconta o porte", grande.scale === "BELOW" && grande.score < 100, `${grande.score}% · ${grande.scale}`);
  checar("e a razão diz o tamanho do que já se executou",
    grande.reasons.some((r) => r.includes("62")), grande.reasons.join(" | "));

  const outroRamo = computeArchiveAdherence({ workTypes: ["SANITATION"], estimatedValue: 30_000_000, inferred: true }, acervo);
  checar("ramo sem acervo cai para zero, mas segue julgado", outroRamo.determined && outroRamo.score === 0, `${outroRamo.score}%`);

  // Limpeza do que é apagável. Documento e versão NÃO são: o banco tem trava
  // de somente-acréscimo sobre evidência documental, e está certo — acervo não
  // se apaga. O rastro fica no banco descartável, que existe para isso.
  await db.executedService.deleteMany({ where: { contractId: { in: [validado.id, rascunho.id] } } });
  await db.executedContract.deleteMany({ where: { id: { in: [validado.id, rascunho.id] } } });
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
if (estouro) {
  console.error("\ninterrompida por erro:", estouro instanceof Error ? estouro.message : estouro);
}
process.exit(falhas || estouro ? 1 : 0);
