/**
 * Prova, contra o PNCP de verdade, que o serviço acha o documento certo dentro
 * do pacote que o órgão publicou.
 *
 * Não chama IA e não escreve nada: baixa o arquivo público, abre o pacote,
 * ordena pela mesma régua do serviço e mostra o que seria lido. É a conferência
 * que separa "os testes passam" de "funciona com o arquivo que a prefeitura
 * publicou de fato".
 *
 *   npx tsx scripts/provar-pacote-edital.mts [numero-de-controle-pncp]
 *
 * O padrão é a Concorrência 17/2026 de Pedra Preta/MT, que foi o caso lido à
 * mão: um .zip com um .rar dentro, 18 arquivos, e as parcelas de maior
 * relevância na justificativa de qualificação técnica — não no edital.
 */
import { editalRelevance, isEdital } from "@/modules/scouting/domain/edital-relevance";
import { parsePncpIdentifier } from "@/modules/scouting/domain/pncp-identifier";
import { listArchive } from "@/modules/scouting/infrastructure/archive-files";
import { PncpFilesClient } from "@/modules/scouting/infrastructure/pncp-files-client";

const PADRAO = "03773942000109-1-000038/2026";

const mb = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

async function main(): Promise<void> {
  const numero = process.argv[2] ?? PADRAO;
  const identificador = parsePncpIdentifier(numero);
  if (!identificador) throw new Error(`Número de controle fora do padrão: ${numero}`);

  console.log(`Licitação ${numero}`);
  const client = new PncpFilesClient();
  const publicados = await client.list(identificador.authorityDocument, identificador.year, identificador.sequence);
  console.log(`\n${publicados.length} arquivo(s) publicado(s):`);
  for (const arquivo of publicados) {
    console.log(`  [peso ${String(editalRelevance(arquivo.documentType, arquivo.title)).padStart(2)}] ${arquivo.documentType} — ${arquivo.title}`);
  }
  if (publicados.length === 0) return;

  const candidatos: Array<{ peso: number; ehEdital: boolean; rotulo: string; tamanho: number }> = [];
  for (const arquivo of publicados.slice(0, 3)) {
    const baixado = await client.download(arquivo);
    if (!baixado) {
      console.log(`\n"${arquivo.title}" passa do teto de tamanho — pulado.`);
      continue;
    }
    console.log(`\nBaixado: ${baixado.filename} (${mb(baixado.bytes.byteLength)}, ${baixado.mimeType})`);

    const membros = await listArchive(baixado);
    if (membros.length === 0) {
      if (baixado.mimeType === "application/pdf") {
        candidatos.push({
          peso: editalRelevance(arquivo.documentType, arquivo.title, baixado.filename),
          ehEdital: isEdital(arquivo.documentType, arquivo.title, baixado.filename),
          rotulo: baixado.filename,
          tamanho: baixado.bytes.byteLength,
        });
      }
      continue;
    }

    console.log(`  pacote com ${membros.length} arquivo(s):`);
    for (const membro of membros) {
      const peso = editalRelevance(membro.filename);
      console.log(`    [peso ${String(peso).padStart(2)}] ${mb(membro.size).padStart(8)}  ${membro.filename}`);
      if (/\.pdf$/i.test(membro.filename)) {
        candidatos.push({ peso, ehEdital: isEdital(membro.filename), rotulo: membro.path, tamanho: membro.size });
      }
    }
  }

  const ordenados = candidatos.sort((a, b) => a.peso - b.peso);
  const principal = ordenados[0];
  if (!principal) {
    console.log("\nNenhum PDF legível — o serviço devolveria NO_FILE.");
    return;
  }
  const complemento = principal.ehEdital
    ? undefined
    : ordenados.find((item) => item !== principal && item.ehEdital);

  console.log(`\n=== o que o serviço leria ===`);
  console.log(`1ª leitura: ${principal.rotulo}  (${mb(principal.tamanho)})`);
  console.log(complemento
    ? `2ª leitura: ${complemento.rotulo}  (${mb(complemento.tamanho)}) — só se a 1ª deixar consórcio/CAT/visita em aberto`
    : "2ª leitura: nenhuma — o principal já é o edital");
}

main().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
