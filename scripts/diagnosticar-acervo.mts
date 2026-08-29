/**
 * Diagnóstico da aderência de acervo contra os dados reais.
 *
 * SOMENTE LEITURA. Não escreve, não apaga, não cria.
 *
 * Existe porque "isto funciona com o nosso acervo?" não se responde com dado
 * inventado, e quem tem a credencial do banco é o dono — não a automação. Você
 * roda com a sua própria conexão; ela nunca passa por mim.
 *
 * Uso:
 *   DATABASE_URL="<a conexão de leitura do G-SIPRO>" \
 *     ./node_modules/.bin/tsx scripts/diagnosticar-acervo.mts
 *
 * A saída mais valiosa é a lista de DISCIPLINAS NÃO RECONHECIDAS: é ela que
 * corrige o catálogo de serviços com dado real em vez de palpite.
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { computeArchiveAdherence } from "../src/modules/scouting/domain/archive-adherence.js";
import { categoriesIn, serviceCatalog } from "../src/modules/scouting/domain/service-catalog.js";
import { PrismaArchiveEvidenceRepository } from "../src/modules/scouting/infrastructure/prisma-scouting-repository.js";

const conexao = process.env.DATABASE_URL;
if (!conexao) {
  console.error("Informe DATABASE_URL. Nada é gravado: o diagnóstico só lê.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: conexao }) });
const barra = (n: number, total: number, largura = 26) =>
  "█".repeat(Math.round((n / Math.max(total, 1)) * largura)).padEnd(largura, "·");

async function main(): Promise<void> {
  /* ---------- 1. o acervo ---------- */
  const acervo = await new PrismaArchiveEvidenceRepository().loadEvidence();

  console.log("\n═══ ACERVO TÉCNICO ═══\n");
  console.log(`Serviços lidos do acervo: ${acervo.length}`);
  if (acervo.length === 0) {
    console.log("\n⚠️  Sem acervo, TODA a fila sai como “acervo não julgado”.");
    console.log("   Não é defeito: é a tela se recusando a dizer 0% sobre o que não mediu.");
    return;
  }

  const comValor = acervo.filter((e) => e.contractValue !== undefined);
  console.log(`Serviços com valor de contrato: ${comValor.length} de ${acervo.length}`);
  if (comValor.length === 0) {
    console.log("⚠️  Nenhum valor de contrato: a comparação de PORTE fica de fora e a nota");
    console.log("   máxima passa a ser 80. Preencher o valor dos atestados destrava isso.");
  }

  console.log("\nCobertura do catálogo — quantos serviços do acervo sustentam cada categoria:");
  const cobertas = serviceCatalog
    .map((c) => ({
      label: c.label,
      n: acervo.filter((e) => categoriesIn(`${e.discipline} ${e.description} ${e.characteristics}`).some((x) => x.id === c.id)).length,
    }))
    .sort((a, b) => b.n - a.n);
  for (const c of cobertas) {
    const marca = c.n === 0 ? "  ← nenhum" : "";
    console.log(`  ${c.label.padEnd(32)} ${String(c.n).padStart(5)}${marca}`);
  }

  const orfaos = acervo.filter((e) => categoriesIn(`${e.discipline} ${e.description} ${e.characteristics}`).length === 0);
  console.log(`\n⚠️  ${orfaos.length} de ${acervo.length} serviços não casaram com nenhuma categoria.`);
  if (orfaos.length > 0) {
    const porDisciplina = new Map<string, number>();
    for (const o of orfaos) porDisciplina.set(o.discipline, (porDisciplina.get(o.discipline) ?? 0) + 1);
    console.log("   Disciplinas mais frequentes entre eles — é isto que corrige o catálogo:");
    for (const [disciplina, n] of [...porDisciplina].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
      console.log(`     ${String(n).padStart(4)}×  ${disciplina.slice(0, 70)}`);
    }
  }

  /**
   * Conflação de categorias.
   *
   * O catálogo é grosso em alguns pontos: "túnel" e "ponte" caem os dois em
   * `obra-de-arte`, então um atestado de ponte cobre uma exigência de túnel.
   * Este mapa mostra, com a nomenclatura REAL dos atestados, onde isso
   * acontece — é a lista que decide quais categorias precisam ser separadas.
   */
  const porCategoria = new Map<string, Set<string>>();
  for (const e of acervo) {
    for (const c of categoriesIn(`${e.discipline} ${e.description} ${e.characteristics}`)) {
      const atual = porCategoria.get(c.label) ?? new Set<string>();
      atual.add(e.discipline.trim().slice(0, 44) || "(sem disciplina)");
      porCategoria.set(c.label, atual);
    }
  }
  const conflacoes = [...porCategoria].filter(([, d]) => d.size > 1).sort((a, b) => b[1].size - a[1].size);
  if (conflacoes.length > 0) {
    console.log("\nCategorias que juntam disciplinas diferentes — candidatas a separar:");
    for (const [categoria, disciplinas] of conflacoes.slice(0, 15)) {
      console.log(`  ${categoria}`);
      console.log(`      ${[...disciplinas].join(" | ")}`);
    }
  }

  /* ---------- 2. a fila de hoje ---------- */
  const fila = await db.scoutedTender.findMany({
    where: { status: "PENDING" },
    select: { id: true, subject: true, authorityName: true, estimatedValue: true, valueUndisclosed: true },
  });

  console.log(`\n═══ FILA DE TRIAGEM — ${fila.length} licitações ═══\n`);
  if (fila.length === 0) { console.log("Fila vazia."); return; }

  const avaliadas = fila.map((t) => ({
    tender: t,
    acervo: computeArchiveAdherence(
      {
        sources: [{ text: t.subject }],
        ...(t.valueUndisclosed || t.estimatedValue === null ? {} : { estimatedValue: Number(t.estimatedValue) }),
        inferred: true,
      },
      acervo,
    ),
  }));

  const julgadas = avaliadas.filter((a) => a.acervo.determined);
  const consorcio = julgadas.filter((a) => a.acervo.needsPartner);
  console.log(`Julgadas: ${julgadas.length}   ·   Não julgadas: ${avaliadas.length - julgadas.length}`);
  console.log(`Indicam consórcio: ${consorcio.length} de ${julgadas.length}`);

  const naoJulgadas = avaliadas.filter((a) => !a.acervo.determined);
  if (naoJulgadas.length > 0) {
    const motivos = new Map<string, number>();
    for (const a of naoJulgadas) for (const r of a.acervo.reasons) motivos.set(r, (motivos.get(r) ?? 0) + 1);
    console.log("\nPor que ficaram sem julgamento:");
    for (const [motivo, n] of [...motivos].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${motivo}`);
  }

  if (julgadas.length > 0) {
    console.log("\nDistribuição das notas de acervo:");
    const faixas: Array<[string, (n: number) => boolean]> = [
      ["90 a 100", (n) => n >= 90], ["70 a 89", (n) => n >= 70 && n < 90],
      ["50 a 69", (n) => n >= 50 && n < 70], ["25 a 49", (n) => n >= 25 && n < 50],
      ["  1 a 24", (n) => n >= 1 && n < 25], ["       0", (n) => n === 0],
    ];
    for (const [nome, dentro] of faixas) {
      const n = julgadas.filter((a) => dentro(a.acervo.score)).length;
      console.log(`  ${nome.padStart(8)}  ${String(n).padStart(4)}  ${barra(n, julgadas.length)}`);
    }

    const faltas = new Map<string, number>();
    for (const a of julgadas) for (const m of a.acervo.missing) faltas.set(m.label, (faltas.get(m.label) ?? 0) + 1);
    if (faltas.size > 0) {
      console.log("\nServiços que mais faltam — a pauta de parceria:");
      for (const [label, n] of [...faltas].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
        console.log(`  ${String(n).padStart(4)}×  ${label}`);
      }
    }

    const ordenadas = [...julgadas].sort((a, b) => b.acervo.score - a.acervo.score);
    const mostrar = (titulo: string, lista: typeof ordenadas) => {
      if (lista.length === 0) return;
      console.log(`\n${titulo}`);
      for (const a of lista) {
        console.log(`\n  ${String(a.acervo.score).padStart(3)}%  ${a.tender.subject.slice(0, 92)}`);
        console.log(`        ${a.tender.authorityName.slice(0, 70)}`);
        console.log(`        ${a.acervo.reasons.join(" · ")}`);
      }
    };
    mostrar("As três de maior aderência:", ordenadas.slice(0, 3));
    mostrar("As três de menor, para conferir se a leitura faz sentido:", ordenadas.slice(-3).reverse());
  }

  console.log("\n───");
  console.log("Lembrete: aqui os serviços exigidos são ESTIMADOS do objeto. O que o edital");
  console.log("cobra de verdade sai da leitura do PDF, que depende do caso de uso de IA");
  console.log("estar cadastrado e aprovado na governança.");
}

try {
  await main();
} catch (erro) {
  console.error("\nO diagnóstico não completou:", erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
