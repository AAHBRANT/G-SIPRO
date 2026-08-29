/**
 * Diagnóstico da aderência de acervo contra dados reais.
 *
 * SOMENTE LEITURA. Não escreve nada, não apaga nada, não cria nada.
 *
 * Existe porque a pergunta "isto funciona com o nosso acervo?" não se responde
 * com dado inventado, e quem tem a credencial do banco é o dono — não a
 * automação. Você roda com a sua própria conexão; ela nunca passa por mim.
 *
 * Uso:
 *   DATABASE_URL="<a conexão de leitura do G-SIPRO>" \
 *     ./node_modules/.bin/tsx scripts/diagnosticar-acervo.mts
 *
 * O que ele imprime: quanto acervo validado existe, como ele se distribui pelos
 * ramos, e como as licitações que estão HOJE na fila seriam pontuadas. Nomes de
 * órgão e objetos aparecem só em três exemplos, para você conferir se a leitura
 * faz sentido.
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { computeArchiveAdherence, certaintyFor, type ArchiveEvidence } from "../src/modules/scouting/domain/archive-adherence.js";
import { resolveWorkTypes } from "../src/modules/scouting/domain/adherence.js";
import { scoutWorkTypes, type ScoutWorkType } from "../src/modules/scouting/domain/scout-filter.js";

const conexao = process.env.DATABASE_URL;
if (!conexao) {
  console.error("Informe DATABASE_URL. Nada é gravado: o diagnóstico só lê.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: conexao }) });

const rotulo: Readonly<Record<ScoutWorkType, string>> = {
  BUILDING: "Edificação",
  SPECIAL_STRUCTURE: "Obra de arte especial",
  PAVING: "Pavimentação e rodovia",
  URBAN_INFRASTRUCTURE: "Infraestrutura urbana",
  SANITATION: "Saneamento e adutora",
  EARTHWORKS: "Contenção e terraplenagem",
  RENOVATION: "Reforma e retrofit",
};

const dinheiro = (v: number) => `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
const barra = (n: number, total: number, largura = 28) =>
  "█".repeat(Math.round((n / Math.max(total, 1)) * largura)).padEnd(largura, "·");

async function main(): Promise<void> {
  /* ---------- 1. o acervo ---------- */
  const porStatus = await db.executedContract.groupBy({ by: ["status"], _count: { _all: true } });
  console.log("\n═══ ACERVO TÉCNICO ═══\n");
  console.log("Contratos por situação:");
  for (const linha of porStatus) {
    const conta = linha._count._all;
    console.log(`  ${linha.status.padEnd(12)} ${String(conta).padStart(4)}  ${conta > 0 && linha.status !== "VALIDATED" ? "(fora do acervo)" : ""}`);
  }

  const servicos = await db.executedService.findMany({
    where: { contract: { status: "VALIDATED" } },
    select: {
      id: true, discipline: true, originalDescription: true, characteristics: true,
      contract: { select: { value: true, subject: true } },
    },
  });

  const acervo: ArchiveEvidence[] = servicos.map((s) => ({
    serviceId: s.id,
    discipline: s.discipline,
    description: s.originalDescription,
    characteristics: s.characteristics,
    ...(s.contract.value !== null ? { contractValue: Number(s.contract.value) } : {}),
    contractSubject: s.contract.subject,
  }));

  console.log(`\nServiços em contrato validado: ${acervo.length}`);
  if (acervo.length === 0) {
    console.log("\n⚠️  Sem acervo validado, TODA a fila sai como “acervo não julgado”.");
    console.log("   Não é defeito: é a tela se recusando a dizer 0% sobre o que não mediu.");
    return;
  }

  const comValor = acervo.filter((e) => e.contractValue !== undefined);
  console.log(`Serviços cujo contrato tem valor: ${comValor.length} de ${acervo.length}`);
  if (comValor.length > 0) {
    const maior = Math.max(...comValor.map((e) => e.contractValue!));
    console.log(`Maior contrato validado: ${dinheiro(maior)}`);
  } else {
    console.log("⚠️  Nenhum contrato tem valor: a comparação de PORTE fica de fora da nota.");
  }

  console.log("\nCobertura por ramo (quantos serviços o acervo comprova):");
  for (const tipo of scoutWorkTypes) {
    const certos = acervo.filter((e) => certaintyFor(e, tipo) === "IDENTICAL").length;
    const provaveis = acervo.filter((e) => certaintyFor(e, tipo) === "LIKELY").length;
    console.log(`  ${rotulo[tipo].padEnd(24)} ${String(certos).padStart(4)} na disciplina  ${String(provaveis).padStart(4)} só na descrição`);
  }

  const semRamo = acervo.filter((e) => scoutWorkTypes.every((t) => certaintyFor(e, t) === "NONE"));
  if (semRamo.length > 0) {
    console.log(`\n⚠️  ${semRamo.length} serviço(s) não casaram com nenhum ramo. Disciplinas que o vocabulário não reconhece:`);
    for (const d of [...new Set(semRamo.map((e) => e.discipline))].slice(0, 12)) console.log(`     · ${d}`);
    console.log("   Vale conferir: ou a disciplina usa outro nome, ou falta termo no vocabulário.");
  }

  /* ---------- 2. a fila de hoje ---------- */
  const fila = await db.scoutedTender.findMany({
    where: { status: "PENDING" },
    select: { id: true, subject: true, authorityName: true, sphere: true, workTypes: true, estimatedValue: true, valueUndisclosed: true },
  });

  console.log(`\n═══ FILA DE TRIAGEM — ${fila.length} licitações ═══\n`);
  if (fila.length === 0) { console.log("Fila vazia."); return; }

  const avaliadas = fila.map((t) => {
    const entrada = {
      subject: t.subject, sphere: t.sphere, workTypes: t.workTypes,
      valueUndisclosed: t.valueUndisclosed,
      ...(t.estimatedValue !== null ? { estimatedValue: Number(t.estimatedValue) } : {}),
    };
    const tipos = resolveWorkTypes(entrada);
    return {
      tender: t,
      tipos,
      acervo: computeArchiveAdherence(
        {
          workTypes: tipos,
          ...(t.valueUndisclosed || t.estimatedValue === null ? {} : { estimatedValue: Number(t.estimatedValue) }),
          inferred: true,
        },
        acervo,
      ),
    };
  });

  const julgadas = avaliadas.filter((a) => a.acervo.determined);
  const naoJulgadas = avaliadas.filter((a) => !a.acervo.determined);
  console.log(`Julgadas: ${julgadas.length}   ·   Não julgadas: ${naoJulgadas.length}`);

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

    const ordenadas = [...julgadas].sort((a, b) => b.acervo.score - a.acervo.score);
    console.log("\nAs três de maior aderência de acervo:");
    for (const a of ordenadas.slice(0, 3)) {
      console.log(`\n  ${a.acervo.score}%  ${a.tender.subject.slice(0, 88)}`);
      console.log(`       ${a.tender.authorityName.slice(0, 70)}`);
      console.log(`       ${a.acervo.reasons.join(" · ")}`);
    }
    if (ordenadas.length > 3) {
      const pior = ordenadas[ordenadas.length - 1]!;
      console.log(`\n  A de menor aderência, para conferir se faz sentido:`);
      console.log(`  ${pior.acervo.score}%  ${pior.tender.subject.slice(0, 88)}`);
      console.log(`       ${pior.acervo.reasons.join(" · ")}`);
    }
  }

  console.log("\n───");
  console.log("Lembrete: o requisito é ESTIMADO do objeto. O que o edital exige de");
  console.log("verdade só está no PDF, que o sistema ainda não lê.");
}

try {
  await main();
} catch (erro) {
  console.error("\nO diagnóstico não completou:", erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
