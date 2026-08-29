/**
 * Prova o encadeamento da leitura de edital contra um PostgreSQL de verdade.
 *
 * O que só o banco real mostra: a tabela certa, o JSON de ida e volta, o
 * Decimal da confiança, os gatilhos e o que a tela consegue reler depois.
 *
 * ⚠️ Não fala com a OpenAI nem com o PNCP. O provedor e o cliente de arquivos
 * entram dublados — o que se prova aqui é o encanamento, não a qualidade da
 * leitura. Rode contra a base descartável, nunca contra produção:
 *
 *   DATABASE_URL="postgresql://gsipro:gsipro-local@localhost:5433/gsipro" \
 *     ./node_modules/.bin/tsx scripts/provar-leitura-edital.mts
 */
import { randomUUID } from "node:crypto";

import { getDatabase } from "@/core/database/prisma";
import { EditalReadingService, type EditalExtractionPort, type TenderFilesPort } from "@/modules/scouting/application/edital-reading-service";
import { toArchiveRequirement } from "@/modules/scouting/domain/edital-requirement";
import { PrismaEditalArchive, PrismaEditalReadingRepository, editalReadingFromRow } from "@/modules/scouting/infrastructure/prisma-edital-reading";
import type { AuthorizationContext } from "@/core/authorization/policy";

const db = getDatabase();
let passou = 0;
let falhou = 0;
const conferir = (rotulo: string, condicao: boolean, detalhe = "") => {
  if (condicao) { passou += 1; console.log(`  ok   ${rotulo}`); }
  else { falhou += 1; console.log(`  FALHA ${rotulo}${detalhe ? ` — ${detalhe}` : ""}`); }
};

/** PDF mínimo válido, para o armazenamento receber bytes de verdade. */
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

const arquivos: TenderFilesPort = {
  async list() {
    return [
      { title: "Anexo I - Projeto", documentType: "Anexo", url: "https://exemplo/arquivos/1", sequence: 1 },
      { title: "Edital 14/2026", documentType: "Edital", url: "https://exemplo/arquivos/2", sequence: 2 },
    ];
  },
  async download(file) {
    // O primeiro é um zip: o serviço tem de pular e ficar com o edital.
    if (file.title.includes("Projeto")) return { filename: "projeto.zip", mimeType: "application/zip", bytes: pdf };
    return { filename: "edital.pdf", mimeType: "application/pdf", bytes: pdf };
  },
};

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("5433")) { console.error("Rode contra a base descartável na porta 5433."); process.exit(1); }

  console.log("preparando cenário");
  const actorId = randomUUID();
  // Duas pessoas: o gatilho gsipro_validate_ai_use_case_approval recusa
  // aprovação feita por quem cadastrou o caso de uso (segregação de funções).
  const aprovadorId = randomUUID();
  for (const [id, nome] of [[actorId, "Quem cadastra"], [aprovadorId, "Quem aprova"]] as const) {
    await db.user.create({
      data: { id, entraObjectId: randomUUID(), displayName: nome, email: `prova-${id}@exemplo.local`, createdBy: id, updatedBy: id },
    });
  }
  const model = await db.aiModelVersion.create({
    data: {
      id: randomUUID(), modelKey: randomUUID(), version: 1, provider: "OpenAI", modelName: "gpt", providerModelVersion: "gpt-5",
      serviceType: "Responses API", dataProcessingRegion: "EUA", retentionRule: "Sem retenção", status: "ACTIVE",
      changeReason: "Prova", sourceReference: "prova", sourceDate: new Date("2026-08-29"), createdBy: actorId, correlationId: randomUUID(),
    },
  });
  const definition = await db.aiUseCaseDefinition.create({
    data: {
      id: randomUUID(), useCaseKey: randomUUID(), version: 1, code: "EDITAL-QUALIF", name: "Leitura de edital",
      purpose: "Extrair qualificação técnica", ownerId: actorId, inputs: ["Edital"], outputs: ["Parcelas"], audience: ["Licitações"],
      riskAssessment: "Leitura assistiva", limitations: ["Não decide"],
      authorizedSources: [{ documentType: "EDITAL", requiredPermission: "documents.read" }],
      evaluationCriteria: ["Conferência humana"], modelVersionId: model.id,
      promptTemplate: "Extraia com evidência.", promptHash: "c".repeat(64),
      effectiveFrom: new Date("2026-08-29"), changeReason: "Prova", createdBy: actorId, correlationId: randomUUID(),
    },
  });
  await db.aiUseCaseApproval.create({
    data: { id: randomUUID(), definitionId: definition.id, note: "Prova", approvedAt: new Date(), approvedBy: aprovadorId, correlationId: randomUUID() },
  });
  const run = await db.scoutRun.create({ data: { id: randomUUID(), status: "COMPLETED" } });
  const tender = await db.scoutedTender.create({
    data: {
      id: randomUUID(), externalId: `07658917000127-1-${Math.floor(Math.random() * 900_000 + 100_000)}/2026`, runId: run.id,
      subject: "Construção de ponte em concreto armado sobre o rio Preto",
      authorityName: "Prefeitura de Exemplo", sphere: "M", modality: "Concorrência", workTypes: ["OBRA_DE_ARTE"],
      estimatedValue: "41500000.0000", proposalClosesAt: new Date(Date.now() + 30 * 86_400_000),
    },
  });

  // A extração é dublada: devolve o que o modelo devolveria, no formato real.
  const extracao: EditalExtractionPort = {
    async approvedDefinition(documentType) {
      const real = await new (await import("@/modules/scouting/infrastructure/prisma-edital-reading")).PrismaEditalExtraction().approvedDefinition(documentType);
      return real;
    },
    async run() {
      return {
        output: {
          content: [
            { field: "Parcelas de maior relevância e quantitativos mínimos", value: JSON.stringify([
              { servico: "Ponte em concreto armado", quantidade: "15", unidade: "m" },
              { servico: "Pavimentação asfáltica", quantidade: "3.500", unidade: "m²" },
            ]) },
            { field: "Permite consórcio", value: "Vedada a participação em consórcio" },
            { field: "Exige atestado registrado no CREA/CAU (CAT)", value: "Sim, exigido" },
            { field: "Exige visita técnica", value: "Não" },
          ],
          confidence: 0.8134,
          limitations: ["Anexo IV não localizado no arquivo"],
        },
      };
    },
  };

  const auth = { actorId } as unknown as AuthorizationContext;
  const service = new EditalReadingService(arquivos, new PrismaEditalArchive(), extracao, new PrismaEditalReadingRepository());

  console.log("\n1. leitura");
  const primeira = await service.read(tender.id, auth);
  conferir("desfecho READ", primeira.status === "READ", primeira.status);

  console.log("\n2. o que ficou gravado");
  const linha = await db.scoutedTenderEditalReading.findUnique({ where: { tenderId: tender.id } });
  conferir("linha existe", Boolean(linha));
  if (linha) {
    const lida = editalReadingFromRow(linha);
    conferir("duas parcelas", lida.requirement.services.length === 2, String(lida.requirement.services.length));
    conferir("quantitativo veio como número", lida.requirement.services[0]?.quantity === 15, JSON.stringify(lida.requirement.services[0]));
    conferir("milhar não virou decimal", lida.requirement.services[1]?.quantity === 3_500, String(lida.requirement.services[1]?.quantity));
    conferir("consórcio vedado", lida.requirement.consortiumAllowed === false);
    conferir("CAT exigida", lida.requirement.requiresCat === true);
    conferir("visita dispensada", lida.requirement.requiresSiteVisit === false);
    // Decimal(5,4) do Prisma não é number: sem converter, a comparação falharia.
    conferir("confiança volta como número", lida.requirement.confidence === 0.8134, String(lida.requirement.confidence));
    conferir("limitação preservada", lida.requirement.limitations[0]?.includes("Anexo IV") === true);
    conferir("nasce sem conferência humana", lida.reviewedAt === undefined);

    const requisito = toArchiveRequirement(lida.requirement, 41_500_000);
    conferir("requisito sai como LIDO, não inferido", requisito?.inferred === false);
    conferir("quantitativo viaja para o confronto", requisito?.sources[0]?.quantity?.value === 15);
  }

  console.log("\n3. o arquivo foi mesmo parar no acervo");
  const documento = await db.managedDocument.findFirst({ where: { type: "EDITAL" }, include: { versions: true, links: true } });
  conferir("documento EDITAL criado", Boolean(documento));
  conferir("classificado como público", documento?.classification === "PUBLIC");
  conferir("versão com hash", /^[a-f0-9]{64}$/.test(documento?.versions[0]?.fileHash ?? ""));
  conferir("é o PDF, não o zip", documento?.versions[0]?.mimeType === "application/pdf", documento?.versions[0]?.mimeType);
  conferir("vinculado à licitação", documento?.links[0]?.entityId === tender.id);

  console.log("\n4. não relê");
  const segunda = await service.read(tender.id, auth);
  conferir("desfecho ALREADY_READ", segunda.status === "ALREADY_READ", segunda.status);
  const documentos = await db.managedDocument.count({ where: { type: "EDITAL" } });
  conferir("não arquivou de novo", documentos === 1, String(documentos));

  console.log("\n5. conferência humana");
  const conferida = await new PrismaEditalReadingRepository().markReviewed(tender.id, actorId);
  conferir("carimbo gravado", Boolean(conferida?.reviewedAt));
  const semLeitura = await new PrismaEditalReadingRepository().markReviewed(run.id, actorId);
  conferir("não carimba o que não foi lido", semLeitura === undefined);

  console.log("\n6. a tela relê pelo mesmo caminho");
  const daTela = await db.scoutedTender.findUnique({ where: { id: tender.id }, include: { signal: true, editalReading: true } });
  conferir("a consulta da tela traz a leitura", Boolean(daTela?.editalReading));
  conferir("e ela chega conferida", Boolean(daTela?.editalReading && editalReadingFromRow(daTela.editalReading).reviewedAt));

  console.log(`\n${passou} ok, ${falhou} falha(s)`);
  await db.$disconnect();
  process.exit(falhou === 0 ? 0 : 1);
}

main().catch(async (error) => { console.error(error); await db.$disconnect(); process.exit(1); });
