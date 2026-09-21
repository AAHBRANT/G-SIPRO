/**
 * Monta o pacote com TODOS os documentos que o órgão publicou para uma
 * licitação — o que a aba "Arquivos" do PNCP mostra.
 *
 * Por que existe: o link de download da tela apontava para o arquivo único que
 * a IA leu, escolhido por `edital-relevance` pelas parcelas com quantitativo —
 * quase nunca o "EDITAL.pdf". Essa escolha está certa para decidir o que ler e
 * errada para quem vai montar proposta e precisa de tudo: projetos, planilhas,
 * memoriais e anexos.
 *
 * O teto não é capricho. Um caso real medido em 21/09/2026 tinha 8 arquivos e
 * 20 MB, dos quais 17,5 MB num único PROJETOS.pdf, e o sistema já registra
 * licitações com 15 a 30 arquivos. Sem teto, uma licitação pesada derruba o
 * contêiner por memória. Quem não couber sai da lista e é DEVOLVIDO ao chamador
 * em `ignorados`, para a tela poder dizer o que ficou de fora em vez de mentir
 * que o pacote está completo.
 *
 * O download segue a ordem em que o cliente entrega os arquivos, que é a ordem
 * de relevância de `edital-relevance` — assim, quando o teto corta, o que sobra
 * de fora é o menos importante.
 */

export type ConteudoBaixado = Readonly<{
  filename: string;
  bytes: Uint8Array;
}>;

export type EntradaDoPacote = Readonly<{
  nome: string;
  conteudo: Uint8Array;
}>;

export type Pacote = Readonly<{
  entradas: readonly EntradaDoPacote[];
  /** Título dos documentos que não entraram, com o motivo já legível. */
  ignorados: readonly string[];
  bytesTotais: number;
}>;

/** Cabe no contêiner de homologação com folga para o maior arquivo isolado. */
export const TETO_PADRAO_BYTES = 120 * 1024 * 1024;

/**
 * Dois anexos com o mesmo nome acontecem de verdade ("ANEXO I.pdf" publicado
 * duas vezes). Sem desempate, o segundo sobrescreve o primeiro dentro do zip e
 * o pacote entrega menos arquivos do que diz entregar.
 */
export function nomeSemColisao(nome: string, usados: Set<string>): string {
  if (!usados.has(nome)) {
    usados.add(nome);
    return nome;
  }
  const ponto = nome.lastIndexOf(".");
  const base = ponto > 0 ? nome.slice(0, ponto) : nome;
  const extensao = ponto > 0 ? nome.slice(ponto) : "";
  for (let n = 2; ; n += 1) {
    const candidato = `${base} (${n})${extensao}`;
    if (!usados.has(candidato)) {
      usados.add(candidato);
      return candidato;
    }
  }
}

export async function montarPacote<A>(
  arquivos: readonly A[],
  baixar: (arquivo: A) => Promise<ConteudoBaixado | null>,
  tituloDe: (arquivo: A) => string,
  tetoBytes: number = TETO_PADRAO_BYTES,
): Promise<Pacote> {
  const entradas: EntradaDoPacote[] = [];
  const ignorados: string[] = [];
  const usados = new Set<string>();
  let bytesTotais = 0;

  for (const arquivo of arquivos) {
    const titulo = tituloDe(arquivo);
    let baixado: ConteudoBaixado | null;
    try {
      baixado = await baixar(arquivo);
    } catch (erro) {
      // Um anexo fora do ar não pode levar o pacote inteiro junto: o resto
      // continua servindo para montar proposta.
      ignorados.push(`${titulo} — o PNCP não entregou (${erro instanceof Error ? erro.message : "erro desconhecido"})`);
      continue;
    }
    if (!baixado) {
      ignorados.push(`${titulo} — maior que o limite por arquivo`);
      continue;
    }
    if (bytesTotais + baixado.bytes.byteLength > tetoBytes) {
      ignorados.push(`${titulo} — não coube no limite do pacote`);
      continue;
    }
    bytesTotais += baixado.bytes.byteLength;
    entradas.push({ nome: nomeSemColisao(baixado.filename, usados), conteudo: baixado.bytes });
  }

  return { entradas, ignorados, bytesTotais };
}
