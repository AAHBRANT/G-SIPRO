/**
 * Confronto item a item: o que a licitação EXIGE contra o que a empresa TEM
 * em atestado.
 *
 * Pedido do dono em 22/09/2026: "preciso de especificidade, não só que a gente
 * tem tantos atestados — comparativo qualitativo e quantitativo do acervo
 * técnico exigido pela licitação e quanto a gente tem em atestados".
 *
 * A tela mostrava uma frase por serviço ("3 atestado(s) no acervo"), enquanto
 * o sistema já calculava tudo isto e jogava fora: quanto o edital pede, qual o
 * maior atestado convertido para a mesma unidade, a soma de todos, quantos
 * entraram na conta e quantos ficaram de fora por unidade incompatível.
 *
 * ⚠️ O veredito olha o MAIOR atestado isolado, nunca a soma — regra que vem de
 * `compareQuantity` e não muda aqui. Nem todo edital aceita somatório, e
 * afirmar cobertura com base numa soma que a comissão pode recusar é o erro
 * caro. A soma aparece ao lado, informada, para quem for conferir o edital.
 */
import type { CoverageItem } from "@/modules/scouting/domain/archive-adherence";

export type SituacaoDoServico = "ATENDE" | "NAO_ALCANCA" | "FALTA" | "SEM_COMPARACAO";

export type LinhaDoComparativo = Readonly<{
  servico: string;
  /** O que a licitação pede, em número e unidade, quando pede. */
  exigido: string;
  /** O que a empresa tem, com os números do acervo. */
  acervo: string;
  situacao: SituacaoDoServico;
  /** Ressalva que muda a leitura da linha, quando existe. */
  ressalva?: string;
}>;

const numero = (valor: number, unidade: string) =>
  `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unidade}`;

const atestados = (quantos: number) => `${quantos} atestado${quantos === 1 ? "" : "s"}`;

function situacaoDe(item: CoverageItem): SituacaoDoServico {
  if (item.evidenceCount === 0) return "FALTA";
  if (!item.quantity) return "ATENDE";
  if (item.quantity.verdict === "COVERED") return "ATENDE";
  if (item.quantity.verdict === "BELOW") return "NAO_ALCANCA";
  return "SEM_COMPARACAO";
}

function acervoDe(item: CoverageItem): string {
  if (item.evidenceCount === 0) return "nenhum atestado";
  const comparacao = item.quantity;
  if (!comparacao || comparacao.comparable === 0) return atestados(item.evidenceCount);

  const unidade = comparacao.required.unit;
  const maior = comparacao.best === undefined ? "" : `maior ${numero(comparacao.best, unidade)}`;
  // A soma só acrescenta quando há mais de um atestado comparável; com um só,
  // repetir o mesmo número em duas colunas confunde mais do que informa.
  const soma = comparacao.total !== undefined && comparacao.comparable > 1
    ? ` · soma ${numero(comparacao.total, unidade)}`
    : "";
  return `${maior}${soma} · ${atestados(item.evidenceCount)}`;
}

function ressalvaDe(item: CoverageItem): string | undefined {
  const ignorados = item.quantity?.ignored ?? 0;
  if (ignorados > 0) {
    return `${atestados(ignorados)} fora da conta: quantitativo em unidade que não dá para converter`;
  }
  if (item.quantity?.verdict === "INCOMPARABLE" && item.evidenceCount > 0) {
    return "o acervo comprova o serviço, mas sem quantitativo comparável ao exigido";
  }
  return undefined;
}

export function compararAcervo(itens: readonly CoverageItem[]): readonly LinhaDoComparativo[] {
  return itens.map((item) => {
    const ressalva = ressalvaDe(item);
    return {
      servico: item.label,
      exigido: item.quantity
        ? numero(item.quantity.required.value, item.quantity.required.unit)
        : "sem quantitativo no edital",
      acervo: acervoDe(item),
      situacao: situacaoDe(item),
      ...(ressalva ? { ressalva } : {}),
    };
  });
}

/** Contagem por situação, para o placar acima da tabela. */
export function resumoDoComparativo(linhas: readonly LinhaDoComparativo[]) {
  return {
    atende: linhas.filter((l) => l.situacao === "ATENDE").length,
    naoAlcanca: linhas.filter((l) => l.situacao === "NAO_ALCANCA").length,
    falta: linhas.filter((l) => l.situacao === "FALTA").length,
    semComparacao: linhas.filter((l) => l.situacao === "SEM_COMPARACAO").length,
    total: linhas.length,
  };
}
