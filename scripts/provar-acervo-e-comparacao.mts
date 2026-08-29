/**
 * Prova o leitor de acervo e a comparação, contra PostgreSQL de verdade.
 *
 * Duas perguntas separadas:
 *   1. O leitor enxerga o acervo do jeito que ele existe na base? (ATESTADO →
 *      última versão → extração da IA, exatamente o que a tela do acervo mostra)
 *   2. A comparação decide certo? Cobertura por serviço E quantitativo, com a
 *      regra que importa: acervo de 30 m cobre exigência de 15 m.
 *
 * ⚠️ Usa dados FABRICADOS no formato da produção. Não substitui rodar contra o
 * acervo real da AAHBRANT — ver `scripts/diagnosticar-acervo.mts`.
 *
 *   DATABASE_URL="postgresql://gsipro:gsipro-local@localhost:5433/gsipro" \
 *     ./node_modules/.bin/tsx scripts/provar-acervo-e-comparacao.mts
 */
import { randomUUID } from "node:crypto";

import { getDatabase } from "@/core/database/prisma";
import { computeArchiveAdherence, type ArchiveAdherence, type ArchiveRequirement } from "@/modules/scouting/domain/archive-adherence";
import { PrismaArchiveEvidenceRepository } from "@/modules/scouting/infrastructure/prisma-scouting-repository";

const db = getDatabase();
let passou = 0;
let falhou = 0;
const conferir = (rotulo: string, condicao: boolean, detalhe = "") => {
  if (condicao) { passou += 1; console.log(`  ok    ${rotulo}`); }
  else { falhou += 1; console.log(`  FALHA ${rotulo}${detalhe ? ` — ${detalhe}` : ""}`); }
};

/** Serviços no formato que a IA devolve hoje na tela do acervo. */
const servicos = [
  { disciplina: "Obras de arte especiais", servico: "Ponte em concreto armado protendido sobre o rio Preto", quantidade: "30", unidade: "m" },
  { disciplina: "Pavimentação", servico: "Pavimentação asfáltica em CBUQ", quantidade: "12.400", unidade: "m²" },
  { disciplina: "Drenagem", servico: "Rede de drenagem urbana com galerias", quantidade: "2.800", unidade: "m" },
  { disciplina: "Terraplenagem", servico: "Terraplenagem, corte e aterro", quantidade: "95.000", unidade: "m³" },
];

async function main() {
  if (!(process.env.DATABASE_URL ?? "").includes("5433")) {
    console.error("Rode contra a base descartável na porta 5433."); process.exit(1);
  }

  const actorId = randomUUID();
  await db.user.create({ data: { id: actorId, entraObjectId: randomUUID(), displayName: "Prova", email: `prova-${actorId}@exemplo.local`, createdBy: actorId, updatedBy: actorId } });
  const model = await db.aiModelVersion.create({ data: { id: randomUUID(), modelKey: randomUUID(), version: 1, provider: "OpenAI", modelName: "gpt", providerModelVersion: "gpt-5", serviceType: "Responses API", dataProcessingRegion: "EUA", retentionRule: "Sem retenção", status: "ACTIVE", changeReason: "Prova", sourceReference: "prova", sourceDate: new Date("2026-08-29"), createdBy: actorId, correlationId: randomUUID() } });
  const definition = await db.aiUseCaseDefinition.create({ data: { id: randomUUID(), useCaseKey: randomUUID(), version: 1, code: "ACERVO", name: "Acervo", purpose: "p", ownerId: actorId, inputs: ["a"], outputs: ["b"], audience: ["c"], riskAssessment: "r", limitations: ["l"], authorizedSources: [{ documentType: "ATESTADO", requiredPermission: "documents.read" }], evaluationCriteria: ["e"], modelVersionId: model.id, promptTemplate: "p", promptHash: "d".repeat(64), effectiveFrom: new Date("2026-08-29"), changeReason: "c", createdBy: actorId, correlationId: randomUUID() } });
  await db.aiUseCaseApproval.create({ data: { id: randomUUID(), definitionId: definition.id, note: "n", approvedAt: new Date(), approvedBy: randomUUID() === actorId ? randomUUID() : await outroUsuario(), correlationId: randomUUID() } });

  // Um atestado como os que existem na base: documento + versão + extração.
  const hash = "e".repeat(64);
  const doc = await db.managedDocument.create({ data: { id: randomUUID(), type: "ATESTADO", title: "CAT 1234 — Ponte sobre o rio Preto", classification: "CONFIDENTIAL_TECHNICAL", status: "ACTIVE", ownerId: actorId, createdBy: actorId, updatedBy: actorId } });
  const versao = await db.managedDocumentVersion.create({ data: { id: randomUUID(), documentId: doc.id, version: 1, uri: `gsipro://documents/sha256/${hash}`, fileHash: hash, mimeType: "application/pdf", sizeBytes: BigInt(1024), origin: "prova", createdBy: actorId } });
  const exec = await db.aiExtractionExecution.create({ data: { id: randomUUID(), idempotencyKey: "acervo-1", definitionId: definition.id, modelVersionId: model.id, documentVersionId: versao.id, documentFileHash: hash, requestedFields: ["Serviços executados e quantidades"], inputHash: hash, status: "RUNNING", startedAt: new Date(), createdBy: actorId, correlationId: randomUUID() } });
  await db.aiExtractionEvidence.create({ data: { id: randomUUID(), executionId: exec.id, documentVersionId: versao.id, documentFileHash: hash, excerpt: "ponte em concreto armado", locator: "página 2" } });
  await db.aiExtractionExecution.update({
    where: { id: exec.id },
    data: {
      status: "SUCCEEDED", completedAt: new Date(), providerResponseId: "r1", confidence: 0.9, limitations: [],
      output: { content: [{ field: "Serviços executados e quantidades", value: JSON.stringify(servicos) }] },
    },
  });

  console.log("1. o leitor enxerga o acervo");
  const acervo = await new PrismaArchiveEvidenceRepository().loadEvidence();
  conferir("leu os quatro serviços do atestado", acervo.length === 4, String(acervo.length));
  conferir("trouxe a disciplina", acervo[0]?.discipline === "Obras de arte especiais", acervo[0]?.discipline);
  conferir("trouxe o quantitativo junto", acervo[0]?.quantities?.[0] === "30 m", JSON.stringify(acervo[0]?.quantities));
  console.log("    serviços lidos:");
  for (const s of acervo) console.log(`      · ${s.discipline} | ${s.description.slice(0, 46)} | ${(s.quantities ?? []).join(", ") || "sem quantitativo"}`);

  const exigir = (sources: ArchiveRequirement["sources"]): ArchiveRequirement => ({ sources, inferred: false });
  // O veredito de QUANTITATIVO vive no item; `scale` é o porte do contrato.
  const veredito = (r: ArchiveAdherence) => r.required[0]?.quantity?.verdict;

  console.log("\n2. a comparação — a regra que importa");
  const menor = computeArchiveAdherence(exigir([{ text: "Ponte em concreto armado", quantity: { value: 15, unit: "m" } }]), acervo);
  conferir("ponte de 30 m COBRE exigência de 15 m", veredito(menor) === "COVERED", String(veredito(menor)));
  conferir("e não pede parceiro", menor.needsPartner === false);
  console.log(`      nota ${menor.score}% · ${menor.reasons.join(" | ")}`);

  const maior = computeArchiveAdherence(exigir([{ text: "Ponte em concreto armado", quantity: { value: 80, unit: "m" } }]), acervo);
  conferir("ponte de 30 m NÃO cobre exigência de 80 m", veredito(maior) === "BELOW", String(veredito(maior)));
  conferir("e aí sim pede parceiro", maior.needsPartner === true);
  console.log(`      nota ${maior.score}% · ${maior.reasons.join(" | ")}`);

  console.log("\n3. a comparação — serviço que a empresa não tem");
  const falta = computeArchiveAdherence(exigir([
    { text: "Ponte em concreto armado", quantity: { value: 15, unit: "m" } },
    { text: "Rede de esgoto com estação elevatória" },
  ]), acervo);
  conferir("aponta o que falta", falta.missing.length >= 1, JSON.stringify(falta.missing.map((m) => m.label)));
  conferir("pede consórcio", falta.needsPartner === true);
  conferir("cobertura parcial, não zero", falta.score > 0 && falta.score < 100, String(falta.score));
  console.log(`      nota ${falta.score}% · falta: ${falta.missing.map((m) => m.label).join(", ")}`);

  console.log("\n3b. parcela que o catálogo não classifica — o defeito consertado hoje");
  const obscura = computeArchiveAdherence(exigir([
    { text: "Ponte em concreto armado" },
    { text: "Linha de transmissão 138 kV" },
  ]), acervo);
  conferir("não some: fica listada como não conferida", obscura.unreadable.length === 1, JSON.stringify(obscura.unreadable));
  conferir("e o motivo diz isso por extenso", obscura.reasons.some((m) => m.includes("não soube classificar")));
  conferir("não vira consórcio por desconhecimento", obscura.needsPartner === false);
  console.log(`      não conferido: ${obscura.unreadable.join("; ")}`);

  console.log("\n4. o que a comparação se recusa a fazer");
  const dimensao = computeArchiveAdherence(exigir([{ text: "Pavimentação asfáltica", quantity: { value: 500, unit: "m" } }]), acervo);
  conferir("não converte m² em m (dimensões diferentes)", veredito(dimensao) === "INCOMPARABLE", String(veredito(dimensao)));
  console.log(`      ${dimensao.reasons.join(" | ")}`);

  const vazio = computeArchiveAdherence(exigir([{ text: "Ponte" }]), []);
  conferir("acervo vazio não vira 0%, vira 'não julgado'", vazio.determined === false, `${vazio.score}%`);

  console.log(`\n${passou} ok, ${falhou} falha(s)`);
  await db.$disconnect();
  process.exit(falhou === 0 ? 0 : 1);
}

/** O gatilho exige aprovador distinto de quem cadastrou. */
async function outroUsuario() {
  const id = randomUUID();
  await db.user.create({ data: { id, entraObjectId: randomUUID(), displayName: "Aprovador", email: `aprov-${id}@exemplo.local`, createdBy: id, updatedBy: id } });
  return id;
}

main().catch(async (error) => { console.error(error); await db.$disconnect(); process.exit(1); });
