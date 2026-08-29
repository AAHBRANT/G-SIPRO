/**
 * Prova o encadeamento da leitura de edital contra um PostgreSQL de verdade.
 *
 * O que só o banco real mostra: os gatilhos da governança aceitando execução
 * sem arquivo arquivado, o CHECK de procedência única, o JSON de ida e volta, o
 * Decimal da confiança, e — o ponto desta versão — que NADA é gravado no acervo
 * documental.
 *
 * ⚠️ Não fala com a OpenAI nem com o PNCP. O provedor e o cliente de arquivos
 * entram dublados; o resto é banco de verdade. Rode contra a base descartável,
 * nunca contra produção:
 *
 *   DATABASE_URL="postgresql://gsipro:gsipro-local@localhost:5433/gsipro" \
 *     ./node_modules/.bin/tsx scripts/provar-leitura-edital.mts
 */
import { createHash, randomUUID } from "node:crypto";

import type { AuthorizationContext } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import { AiExtractionService } from "@/modules/ai-extraction/application/ai-extraction-service";
import { PrismaAiExtractionRepository } from "@/modules/ai-extraction/infrastructure/prisma-ai-extraction-repository";
import type { AiExtractionProvider } from "@/modules/ai-extraction/domain/ai-extraction";
import { EditalReadingService, type EditalExtractionPort, type TenderFilesPort } from "@/modules/scouting/application/edital-reading-service";
import { toArchiveRequirement } from "@/modules/scouting/domain/edital-requirement";
import { PrismaEditalExtraction, PrismaEditalReadingRepository, editalReadingFromRow } from "@/modules/scouting/infrastructure/prisma-edital-reading";

const db = getDatabase();
let passou = 0;
let falhou = 0;
const conferir = (rotulo: string, condicao: boolean, detalhe = "") => {
  if (condicao) { passou += 1; console.log(`  ok    ${rotulo}`); }
  else { falhou += 1; console.log(`  FALHA ${rotulo}${detalhe ? ` — ${detalhe}` : ""}`); }
};

/** PDF mínimo, para os bytes serem reais e o hash ter o que morder. */
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
const hashDoPdf = createHash("sha256").update(pdf).digest("hex");

const arquivos: TenderFilesPort = {
  async list() {
    return [
      { title: "Anexo I - Projeto", documentType: "Anexo", url: "https://pncp.gov.br/arquivos/1", sequence: 1 },
      { title: "Edital 14/2026", documentType: "Edital", url: "https://pncp.gov.br/arquivos/2", sequence: 2 },
    ];
  },
  async download(file) {
    // O primeiro é um zip: o serviço tem de pular e ficar com o edital.
    if (file.title.includes("Projeto")) return { filename: "projeto.zip", mimeType: "application/zip", bytes: pdf };
    return { filename: "edital.pdf", mimeType: "application/pdf", bytes: pdf };
  },
};

/** Provedor dublado: devolve o que o modelo devolveria, no formato real. */
const provedor: AiExtractionProvider = {
  async execute() {
    return {
      providerResponseId: "resp-prova",
      result: {
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
        evidence: [{ excerpt: "ponte em concreto armado com extensão mínima de 15 m", locator: "item 9.1.2" }],
      },
    };
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

  // A extração é REAL contra o banco (gatilhos, CHECKs, evidência); só o
  // provedor da OpenAI é dublado.
  const extracaoReal = new PrismaEditalExtraction();
  const servicoReal = new AiExtractionService(new PrismaAiExtractionRepository(), provedor);
  const extracao: EditalExtractionPort = {
    approvedDefinition: (tipo) => extracaoReal.approvedDefinition(tipo),
    runEphemeral: ({ bytes, ...pedido }, auth, correlation) =>
      servicoReal.executeEphemeral({ ...pedido, requestedFields: [...pedido.requestedFields] }, bytes, auth, correlation),
  };

  const auth = { actorId, permissions: new Set(["ai.execute", "documents.read"]) } as unknown as AuthorizationContext;
  const service = new EditalReadingService(arquivos, extracao, new PrismaEditalReadingRepository());

  console.log("\n1. leitura");
  const primeira = await service.read(tender.id, auth);
  conferir("desfecho READ", primeira.status === "READ", primeira.status === "FAILED" ? primeira.reason : primeira.status);

  console.log("\n2. NADA foi para o acervo documental");
  const documentos = await db.managedDocument.count();
  const versoes = await db.managedDocumentVersion.count();
  conferir("nenhum ManagedDocument criado", documentos === 0, String(documentos));
  conferir("nenhuma versão de documento criada", versoes === 0, String(versoes));

  console.log("\n3. a execução de IA passou pelos gatilhos sem arquivo");
  const execucao = await db.aiExtractionExecution.findFirst({ include: { evidence: true } });
  conferir("execução gravada", Boolean(execucao));
  conferir("status SUCCEEDED", execucao?.status === "SUCCEEDED", execucao?.errorMessage ?? execucao?.status);
  conferir("sem versão documental", execucao?.documentVersionId === null);
  conferir("com endereço de origem", execucao?.sourceUri === "https://pncp.gov.br/arquivos/2", execucao?.sourceUri ?? "nulo");
  conferir("hash é o dos bytes", execucao?.documentFileHash === hashDoPdf);
  conferir("tamanho gravado", execucao?.sourceSizeBytes === BigInt(pdf.byteLength), String(execucao?.sourceSizeBytes));
  conferir("data de captura gravada", Boolean(execucao?.sourceFetchedAt));
  conferir("evidência gravada sem documento", execucao?.evidence[0]?.documentVersionId === null && execucao.evidence.length === 1);
  conferir("evidência com trecho e localizador", Boolean(execucao?.evidence[0]?.excerpt && execucao.evidence[0]?.locator));

  console.log("\n4. o que ficou gravado na leitura");
  const linha = await db.scoutedTenderEditalReading.findUnique({ where: { tenderId: tender.id } });
  conferir("linha existe", Boolean(linha));
  if (linha) {
    const lida = editalReadingFromRow(linha);
    conferir("aponta para a execução", lida.executionId === execucao?.id);
    conferir("guarda o link de download", lida.source.uri === "https://pncp.gov.br/arquivos/2");
    conferir("guarda o nome do arquivo", lida.source.filename === "edital.pdf");
    conferir("guarda o hash do que foi lido", lida.source.fileHash === hashDoPdf);
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

  console.log("\n5. não relê");
  const segunda = await service.read(tender.id, auth);
  conferir("desfecho ALREADY_READ", segunda.status === "ALREADY_READ", segunda.status);
  conferir("nenhuma execução a mais", (await db.aiExtractionExecution.count()) === 1);

  console.log("\n6. conferência humana e rastro");
  const conferida = await new PrismaEditalReadingRepository().markReviewed(tender.id, actorId, randomUUID());
  conferir("carimbo gravado", Boolean(conferida?.reviewedAt));
  const semLeitura = await new PrismaEditalReadingRepository().markReviewed(run.id, actorId, randomUUID());
  conferir("não carimba o que não foi lido", semLeitura === undefined);
  const eventos = await db.auditEvent.findMany({ where: { origin: "edital-reading" }, select: { action: true } });
  const acoes = eventos.map((e) => e.action);
  conferir("evento de leitura registrada", acoes.includes("EDITAL_READING_RECORDED"), acoes.join(","));
  conferir("evento de conferência registrada", acoes.includes("EDITAL_READING_REVIEWED"), acoes.join(","));

  console.log("\n7. a tela relê pelo mesmo caminho");
  const daTela = await db.scoutedTender.findUnique({ where: { id: tender.id }, include: { signal: true, editalReading: true } });
  conferir("a consulta da tela traz a leitura", Boolean(daTela?.editalReading));
  conferir("e ela chega conferida", Boolean(daTela?.editalReading && editalReadingFromRow(daTela.editalReading).reviewedAt));

  console.log("\n8. as travas de procedência no banco");
  /**
   * Cada tentativa tem de ser RECUSADA; qual guarda pegou é informação, não
   * exigência. O gatilho roda antes dos CHECK, então ele costuma chegar
   * primeiro — o que importa é que nenhuma linha malformada entra.
   */
  const recusa = async (rotulo: string, sql: string, params: unknown[]) => {
    try {
      await db.$transaction(async (tx) => { await tx.$executeRawUnsafe(sql, ...params); throw new Error("__aceitou__"); });
      conferir(rotulo, false, "ACEITOU");
    } catch (error) {
      const texto = String((error as { message?: string }).message ?? error);
      if (texto.includes("__aceitou__")) { conferir(rotulo, false, "ACEITOU e depois desfez"); return; }
      const guarda = /one_source/.test(texto) ? "CHECK de procedência única"
        : /ephemeral_complete/.test(texto) ? "CHECK de identificação completa"
        : /Execução sem arquivo/.test(texto) ? "gatilho de entrada"
        : /Hash da fonte/.test(texto) ? "gatilho de hash"
        : texto.slice(0, 60);
      conferir(`${rotulo} (${guarda})`, true);
    }
  };

  const colunas = '(id,"idempotencyKey","definitionId","modelVersionId","documentVersionId","sourceUri","sourceFilename","sourceMimeType","sourceSizeBytes","sourceFetchedAt","documentFileHash","requestedFields","inputHash",status,"startedAt","createdBy","correlationId")';
  const sqlLinha = (chave: string, versao: string, uri: string, resto: string) =>
    `INSERT INTO ai_extraction_executions ${colunas} VALUES (gen_random_uuid(),'${chave}','${definition.id}','${model.id}',${versao},${uri},${resto},'${hashDoPdf}','[]','${hashDoPdf}','RUNNING',now(),'${actorId}',gen_random_uuid())`;

  await recusa("recusa execução sem procedência nenhuma", sqlLinha("z1", "NULL", "NULL", "NULL,NULL,NULL,NULL"), []);
  await recusa("recusa meia identificação da fonte", sqlLinha("z2", "NULL", "'https://x'", "NULL,NULL,NULL,NULL"), []);

  // Para o CHECK de procedência única ser alcançado, o documento tem de existir
  // e o hash tem de bater — senão o gatilho recusa antes, por outro motivo.
  const doc = await db.managedDocument.create({
    data: { id: randomUUID(), type: "ATESTADO", title: "Documento de prova", classification: "INTERNAL", status: "ACTIVE", ownerId: actorId, createdBy: actorId, updatedBy: actorId },
  });
  const versao = await db.managedDocumentVersion.create({
    data: { id: randomUUID(), documentId: doc.id, version: 1, uri: `gsipro://documents/sha256/${hashDoPdf}`, fileHash: hashDoPdf, mimeType: "application/pdf", sizeBytes: BigInt(pdf.byteLength), origin: "prova", createdBy: actorId },
  });
  await recusa("recusa as duas procedências ao mesmo tempo",
    sqlLinha("z3", `'${versao.id}'`, "'https://x'", "'e.pdf','application/pdf',10,now()"), []);
  // E o caminho arquivado continua funcionando como antes.
  const arquivada = await db.aiExtractionExecution.create({
    data: { id: randomUUID(), idempotencyKey: "z4", definitionId: definition.id, modelVersionId: model.id, documentVersionId: versao.id, documentFileHash: hashDoPdf, requestedFields: ["Objeto"], inputHash: hashDoPdf, status: "RUNNING", startedAt: new Date(), createdBy: actorId, correlationId: randomUUID() },
  });
  conferir("o caminho arquivado continua aceito", arquivada.documentVersionId === versao.id && arquivada.sourceUri === null);

  console.log(`\n${passou} ok, ${falhou} falha(s)`);
  await db.$disconnect();
  process.exit(falhou === 0 ? 0 : 1);
}

main().catch(async (error) => { console.error(error); await db.$disconnect(); process.exit(1); });
