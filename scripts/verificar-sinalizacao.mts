/**
 * Verificação ponta a ponta da sinalização contra o PostgreSQL de verdade.
 *
 * Não faz parte da suíte: a suíte roda sem banco, e transformar isto em teste
 * quebraria a CI. É um roteiro de conferência para quando o esquema ou o
 * repositório mudarem — o que dublê de teste não consegue provar é que o SQL
 * escrito à mão e o mapeamento do Prisma batem com a realidade.
 *
 * Uso, com o Postgres descartável no ar em 5433:
 *   DATABASE_URL=... ./node_modules/.bin/tsx scripts/verificar-sinalizacao.mts
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { SignalService, SignalNotFoundError, TenderAlreadyDecidedError } from "../src/modules/scouting/application/signal-service.js";
import { PrismaSignalRepository } from "../src/modules/scouting/infrastructure/prisma-scouting-repository.js";

// O Prisma 7 exige adaptador explícito; aqui ele aponta para o banco
// descartável, nunca para o de produção.
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const casos: Array<{ nome: string; ok: boolean; detalhe: string }> = [];
const checar = (nome: string, ok: boolean, detalhe = "") => { casos.push({ nome, ok, detalhe }); };

async function main(): Promise<void> {
  const marca = `verificacao-${Date.now()}`;
  // createdBy e updatedBy são UUID de auditoria: aqui cada registro é autor de
  // si mesmo, já que não existe usuário anterior neste banco descartável.
  const autoria = crypto.randomUUID();

  const usuario = await db.user.create({
    data: { entraObjectId: crypto.randomUUID(), displayName: "Conferência", email: `${marca}@exemplo.invalido`, createdBy: autoria, updatedBy: autoria },
  });
  const run = await db.scoutRun.create({ data: { trigger: "MANUAL", status: "COMPLETED" } });
  const criarLicitacao = (status: "PENDING" | "APPROVED") => db.scoutedTender.create({
    data: {
      externalId: `${marca}-${status}`, subject: "Obra de conferência", authorityName: "ÓRGÃO DE TESTE",
      sphere: "E", modality: "Concorrência - Eletrônica", workTypes: ["PAVING"], runId: run.id, status,
    },
  });

  const naFila = await criarLicitacao("PENDING");
  const decidida = await criarLicitacao("APPROVED");
  const service = new SignalService(new PrismaSignalRepository());

  // 1. Fincar um nível fixo.
  const alta = await service.signal(naFila.id, { level: "HIGH", note: "conferir consórcio" }, usuario.id);
  const gravadaAlta = await db.scoutedTenderSignal.findUnique({ where: { tenderId: naFila.id } });
  checar("grava o nível fixo com rótulo e cor do nível",
    gravadaAlta?.level === "HIGH" && gravadaAlta.label === "Prioridade alta" && gravadaAlta.color.trim() === "#a31414",
    `${gravadaAlta?.level} · ${gravadaAlta?.label} · ${gravadaAlta?.color}`);
  checar("guarda a observação", gravadaAlta?.note === "conferir consórcio", String(gravadaAlta?.note));
  checar("registra quem sinalizou", gravadaAlta?.signaledById === usuario.id);
  checar("devolve os dois tons", alta.light !== alta.dark, `${alta.light} / ${alta.dark}`);

  // 2. Sinalizar de novo substitui, e não cria uma segunda marca.
  const outro = await db.user.create({
    data: { entraObjectId: crypto.randomUUID(), displayName: "Outro", email: `${marca}-2@exemplo.invalido`, createdBy: autoria, updatedBy: autoria },
  });
  await service.signal(naFila.id, { level: "CUSTOM", label: "aguardando acervo", color: "#6B3FA0" }, outro.id);
  const quantas = await db.scoutedTenderSignal.count({ where: { tenderId: naFila.id } });
  const gravadaLivre = await db.scoutedTenderSignal.findUnique({ where: { tenderId: naFila.id } });
  checar("sinalizar de novo substitui em vez de acumular", quantas === 1, `${quantas} marca(s)`);
  checar("a substituição troca nível, rótulo, cor e autor",
    gravadaLivre?.level === "CUSTOM" && gravadaLivre.label === "aguardando acervo"
    && gravadaLivre.color.trim() === "#6b3fa0" && gravadaLivre.signaledById === outro.id,
    `${gravadaLivre?.label} · ${gravadaLivre?.color} · autor trocado: ${gravadaLivre?.signaledById === outro.id}`);
  checar("a observação antiga não sobrevive à troca", gravadaLivre?.note === null, String(gravadaLivre?.note));

  // 3. A relação aparece na leitura da fila, que é como a tela consome.
  const comRelacao = await db.scoutedTender.findUnique({ where: { id: naFila.id }, include: { signal: true } });
  checar("a tela enxerga a sinalização pela relação", comRelacao?.signal?.label === "aguardando acervo", String(comRelacao?.signal?.label));

  // 4. Licitação fora da fila não aceita marca.
  let recusou = false;
  try { await service.signal(decidida.id, { level: "HIGH" }, usuario.id); }
  catch (erro) { recusou = erro instanceof TenderAlreadyDecidedError; }
  checar("recusa sinalizar licitação já decidida", recusou);

  // 5. Remover.
  await service.unsignal(naFila.id);
  checar("remover apaga a marca", (await db.scoutedTenderSignal.count({ where: { tenderId: naFila.id } })) === 0);
  let avisou = false;
  try { await service.unsignal(naFila.id); }
  catch (erro) { avisou = erro instanceof SignalNotFoundError; }
  checar("remover o que não existe avisa, em vez de fingir sucesso", avisou);

  // 6. Apagar a licitação leva a marca junto (ON DELETE CASCADE).
  await service.signal(naFila.id, { level: "LOW" }, usuario.id);
  await db.scoutedTender.delete({ where: { id: naFila.id } });
  checar("apagar a licitação leva a sinalização junto",
    (await db.scoutedTenderSignal.count({ where: { tenderId: naFila.id } })) === 0);

  // Limpeza.
  await db.scoutedTender.deleteMany({ where: { runId: run.id } });
  await db.scoutRun.delete({ where: { id: run.id } });
  await db.user.deleteMany({ where: { id: { in: [usuario.id, outro.id] } } });
}

try {
  await main();
} finally {
  await db.$disconnect();
}

let falhas = 0;
for (const c of casos) {
  if (!c.ok) falhas += 1;
  console.log(`${c.ok ? "  ok  " : " FALHA"} ${c.nome}${c.detalhe ? "  — " + c.detalhe : ""}`);
}
console.log(`\n${casos.length - falhas}/${casos.length} passaram`);
process.exit(falhas ? 1 : 0);
