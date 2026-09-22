/**
 * Prova, ponta a ponta, o que a aprovação de uma licitação rastreada cria.
 *
 * Monta uma licitação sintética no banco local com o identificador real de
 * uma contratação do PNCP, aprova pelo serviço de verdade e roda o mesmo
 * passo que a rota dispara em segundo plano. No fim, lista campo a campo o
 * que ficou preenchido — é a resposta para "ao aprovar, preenche tudo?".
 *
 * ⚠️ Fala com o PNCP de verdade para baixar e conferir os arquivos, e escreve
 * na base descartável. Nunca rodar contra produção:
 *
 *   ./node_modules/.bin/tsx --env-file=.env.local scripts/provar-aprovacao.mts
 */
import { randomUUID } from "node:crypto";

import { getDatabase } from "@/core/database/prisma";
import { montarLicitacaoDaAprovacao } from "@/modules/scouting/application/licitacao-da-aprovacao-service";
import { codigoDaLicitacao } from "@/modules/scouting/domain/licitacao-da-aprovacao";
import { parsePncpIdentifier } from "@/modules/scouting/domain/pncp-identifier";
import { TriageService } from "@/modules/scouting/application/triage-service";
import { OpportunityFromScoutedTender, PrismaTriageRepository } from "@/modules/scouting/infrastructure/prisma-scouting-repository";

const db = getDatabase();
const marca = (ok: boolean) => (ok ? "PREENCHIDO" : "-- VAZIO --");
const linha = (nome: string, valor: unknown) => {
  const ok = valor !== null && valor !== undefined && valor !== "";
  console.log(`  ${marca(ok).padEnd(12)} ${nome.padEnd(22)} ${ok ? String(valor).slice(0, 56) : ""}`);
};

async function main() {
  if (!/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/.test(process.env.DATABASE_URL ?? "")) {
    throw new Error("Prova permitida somente no PostgreSQL local G-SIPRO em 5433.");
  }
  const ator = await db.user.findFirstOrThrow({ where: { status: "ACTIVE" } });
  const sufixo = Date.now();

  const run = await db.scoutRun.create({
    data: { id: randomUUID(), trigger: "MANUAL", status: "COMPLETED", finishedAt: new Date() },
  });

  /**
   * Repetível de propósito: o identificador tem de ser o de uma contratação
   * REAL para o PNCP devolver arquivos, e ele é único na tabela. Rodar a prova
   * duas vezes é normal, então a segunda reaproveita o registro e o devolve
   * para PENDING, em vez de morrer numa violação de chave — o defeito que a
   * auditoria de 22/09/2026 apontou nas outras provas.
   */
  const externalId = process.argv[2] ?? "27142058000126-1-000597/2026";
  const existente = await db.scoutedTender.findUnique({ where: { externalId }, select: { id: true } });
  if (existente) {
    await db.scoutedTender.update({
      where: { id: existente.id },
      data: { status: "PENDING", opportunityId: null, decidedAt: null, decidedById: null, decisionReason: null, runId: run.id },
    });
    console.log("licitacao de prova reaproveitada e devolvida para PENDING");
  }
  const licitacao = existente ? await db.scoutedTender.findUniqueOrThrow({ where: { id: existente.id } }) : await db.scoutedTender.create({
    data: {
      id: randomUUID(),
      externalId,
      source: "PNCP",
      subject: `Obra de prova para ${externalId}`,
      // Nome e documento saem do identificador recebido: com valores fixos, a
      // prova de uma licitação de Criciúma sairia cadastrando "Vitória", e a
      // leitura da saída viraria um quebra-cabeça.
      authorityName: `ORGAO DE PROVA ${externalId} ${sufixo}`,
      authorityDocument: externalId.slice(0, 14),
      sphere: "M",
      city: "Cidade de prova",
      state: "ES",
      modality: "Concorrencia - Eletronica",
      workTypes: ["Infraestrutura urbana"],
      processNumber: externalId,
      estimatedValue: 16_317_585,
      valueUndisclosed: false,
      proposalOpensAt: new Date("2026-09-17T13:00:00.000Z"),
      proposalClosesAt: new Date("2026-12-22T13:00:00.000Z"),
      noticeUrl: `https://pncp.gov.br/app/editais/${externalId.slice(0, 14)}/2026/prova`,
      status: "PENDING",
      runId: run.id,
    },
  });

  console.log("aprovando pelo servico real...");
  const oportunidadeId = await new TriageService(new PrismaTriageRepository(), new OpportunityFromScoutedTender())
    .approve(licitacao.id, ator.id, randomUUID());

  console.log("montando a ficha da licitacao (o que a rota faz em segundo plano)...");
  const inicio = Date.now();
  await montarLicitacaoDaAprovacao(licitacao.id, oportunidadeId, ator.id, randomUUID());
  console.log(`levou ${((Date.now() - inicio) / 1000).toFixed(1)}s`);

  const o = await db.opportunity.findUniqueOrThrow({ where: { id: oportunidadeId } });
  const orgao = o.contractingAuthorityId
    ? await db.contractingAuthority.findUnique({ where: { id: o.contractingAuthorityId } })
    : null;

  console.log("\n=== FICHA DA OPORTUNIDADE ===");
  linha("codigo", o.code);
  linha("objeto", o.subject);
  linha("situacao", o.status);
  linha("orgao vinculado", o.contractingAuthorityId);
  linha("valor estimado", o.estimatedValue?.toString());
  linha("abertura", o.publishedAt?.toISOString().slice(0, 10));
  linha("fechamento", o.deliveryAt?.toISOString().slice(0, 10));
  linha("responsavel", o.ownerId);

  console.log("\n=== ORGAO ===");
  if (!orgao) {
    console.log("  -- VAZIO --  nenhum orgao vinculado");
  } else {
    console.log(`  cadastrado pela aprovacao? ${orgao.createdAt.getTime() > Date.now() - 120_000 ? "SIM" : "nao, ja existia"}`);
    linha("nome", orgao.name);
    linha("esfera", orgao.sphere);
    linha("localidade", orgao.locality);
    linha("identificadores", JSON.stringify(orgao.identifiers));
  }

  console.log("\n=== FICHA DA LICITACAO ===");
  // Procura pelo CODIGO, e não pela oportunidade: numa segunda execução a
  // ficha já existe de antes, ligada à oportunidade anterior, e procurar só
  // pela nova daria "não criou" quando na verdade criou da primeira vez.
  const identificador = parsePncpIdentifier(externalId);
  const tender = identificador
    ? await db.tender.findFirst({
      where: { code: codigoDaLicitacao(identificador) },
      include: { versions: { include: { attachments: true } } },
    })
    : null;
  if (!tender) {
    console.log("  -- VAZIO --  nenhuma ficha de licitacao criada");
  } else {
    linha("codigo", tender.code);
    linha("numero do processo", tender.number);
    linha("modalidade", tender.modality);
    linha("origem", tender.origin);
    linha("orgao", tender.contractingAuthorityId);
    for (const v of tender.versions) {
      console.log(`\n  --- edital, versao ${v.version} ---`);
      console.log(`  arquivo:  ${v.fileName.slice(0, 60)}`);
      console.log(`  tamanho:  ${(Number(v.sizeBytes) / 1024).toFixed(0)} KB · ${v.mimeType}`);
      console.log(`  digital:  ${v.fileHash.slice(0, 20)}...`);
      console.log(`  ANEXOS VINCULADOS: ${v.attachments.length}`);
      for (const a of v.attachments) console.log(`     - ${a.fileName.slice(0, 55)}`);
    }
  }

  const fila = await db.scoutedTender.findUniqueOrThrow({ where: { id: licitacao.id } });
  console.log(`\nlicitacao na fila: ${fila.status} · ligada a oportunidade: ${fila.opportunityId === oportunidadeId ? "sim" : "NAO"}`);
  await db.$disconnect();
}

await main();
