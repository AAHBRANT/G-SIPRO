/**
 * Confere se dá para calcular distância real da licitação até a base
 * operacional mais próxima — e mostra o resultado para uma amostra da fila.
 *
 * SOMENTE LEITURA. Não escreve, não apaga, não cria.
 *
 * Existe porque "temos distância às bases operacionais para calcular?" tinha
 * uma pendência: as Bases Operacionais precisavam ter latitude/longitude
 * cadastrados, e isso dependia de alguém confirmar se o dado existe. Em vez de
 * adivinhar, este script confere contra o banco de verdade.
 *
 * Uso:
 *   DATABASE_URL="<a conexão de leitura do G-SIPRO>" \
 *     ./node_modules/.bin/tsx scripts/verificar-distancia-bases.mts
 *
 * ⚠️ Este script só CALCULA a distância — não decide se ela reprova a
 * licitação nem ajusta piso de valor nenhum. Essa régua ("quanto mais longe,
 * mais caro mobilizar") é decisão de negócio que ainda não tem número.
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { coordenadaDoMunicipio, nearestBase, type BaseOperacional } from "../src/modules/scouting/domain/distance.js";

const conexao = process.env.DATABASE_URL;
if (!conexao) {
  console.error("Informe DATABASE_URL. Nada é gravado: o script só lê.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: conexao }) });

async function main(): Promise<void> {
  console.log("\n═══ BASES OPERACIONAIS ═══\n");
  const bases = await db.operationalBase.findMany({ where: { active: true } });
  console.log(`${bases.length} base(s) ativa(s) cadastrada(s).`);
  if (bases.length === 0) {
    console.log("\n⚠️  Nenhuma base ativa: a distância não tem contra o quê calcular.");
    console.log("   Sem isto, todo cartão mostraria \"distância não calculada\" para sempre.");
    await db.$disconnect();
    return;
  }
  for (const b of bases) {
    console.log(`  ${b.name} — ${b.locality} (${Number(b.latitude).toFixed(4)}, ${Number(b.longitude).toFixed(4)})`);
  }

  const baseOperacionais: readonly BaseOperacional[] = bases.map((b) => ({
    id: b.id, name: b.name, lat: Number(b.latitude), lng: Number(b.longitude),
  }));

  console.log("\n═══ AMOSTRA DA FILA ═══\n");
  const fila = await db.scoutedTender.findMany({
    where: { status: "PENDING" },
    select: { subject: true, city: true, state: true },
    take: 30,
    orderBy: { createdAt: "desc" },
  });
  console.log(`${fila.length} licitação(ões) na amostra.\n`);

  let calculadas = 0;
  let semMunicipioReconhecido = 0;
  for (const tender of fila) {
    const coordenada = coordenadaDoMunicipio(tender.city ?? undefined, tender.state ?? undefined);
    const resultado = nearestBase(coordenada, baseOperacionais);
    const local = `${tender.city ?? "?"}/${tender.state ?? "?"}`;
    if (resultado) {
      calculadas++;
      console.log(`  OK   ${local.padEnd(28)} → ${resultado.distanceKm.toFixed(0)} km até ${resultado.base.name}`);
    } else {
      semMunicipioReconhecido++;
      console.log(`  --   ${local.padEnd(28)} → município não reconhecido pelo IBGE`);
    }
  }

  console.log(`\n${calculadas} de ${fila.length} calculadas.`);
  if (semMunicipioReconhecido > 0) {
    console.log(`${semMunicipioReconhecido} sem município reconhecido — conferir se "city" vem preenchido e com`);
    console.log(`grafia igual à do IBGE (acento não importa, mas cidade errada ou vazia, sim).`);
  }
}

main()
  .catch((erro: unknown) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
