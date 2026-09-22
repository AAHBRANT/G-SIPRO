/**
 * Funil comercial: do que o portal publicou até a proposta enviada.
 *
 * Responde a pergunta que a diretoria faz — "de tudo que saiu, quanto virou
 * proposta nossa?" — e é a base da tela de Análise.
 *
 * ⚠️ COORTE POR ENTRADA NA FILA. Toda etapa é contada no mês em que a
 * licitação ENTROU na fila, não no mês em que a etapa aconteceu. Sem isso, a
 * razão entre duas etapas compara conjuntos diferentes: um estudo concluído em
 * setembro sobre licitação de julho apareceria dividido pelo total de setembro,
 * e a taxa poderia passar de 100% sem nenhum erro de dado. Quem monta as
 * consultas tem de respeitar esse critério; o domínio só confia nele.
 *
 * ⚠️ Nenhum cálculo aqui devolve NaN ou Infinity. Não é preciosismo: uma
 * largura de barra inválida é descartada pelo navegador, e a barra aparece
 * CHEIA — ausência de dado fica idêntica a "converteu tudo", que é o pior
 * desfecho possível numa tela de decisão.
 */

export const etapasDoFunil = ["aderentes", "aprovadas", "orcamento", "propostas"] as const;
export type EtapaDoFunil = (typeof etapasDoFunil)[number];

export const rotuloDaEtapa: Record<EtapaDoFunil, string> = {
  aderentes: "Aderentes ao nosso perfil",
  aprovadas: "Aprovadas para estudo",
  orcamento: "Com orçamento concluído",
  propostas: "Propostas enviadas",
};

/** Um mês da série, com o que cada etapa acumulou naquela coorte. */
export type MesDoFunil = Readonly<{
  /** Primeiro dia do mês, em UTC. */
  mes: string;
  /** Editais que a varredura leu no portal. Nulo quando não houve varredura. */
  publicados: number | null;
  quantidade: Readonly<Record<EtapaDoFunil, number>>;
  /** Valor estimado somado, em reais. Nulo quando nenhuma licitação o informou. */
  valor: Readonly<Record<EtapaDoFunil, number | null>>;
}>;

export type TotalDaEtapa = Readonly<{
  etapa: EtapaDoFunil;
  rotulo: string;
  quantidade: number;
  valor: number | null;
  /** Média de valor por licitação, em reais. Nulo sem valor ou sem licitação. */
  ticketMedio: number | null;
}>;

export type ResumoDoFunil = Readonly<{
  publicados: number | null;
  etapas: readonly TotalDaEtapa[];
  meses: readonly MesDoFunil[];
}>;

const finito = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Soma que preserva a ausência: se qualquer parcela é desconhecida, o total é
 * desconhecido. Tratar ausente como zero produziria um total menor que o real,
 * apresentado com a mesma confiança de um total completo.
 */
export function somaPreservandoAusencia(valores: readonly (number | null)[]): number | null {
  if (valores.length === 0) return null;
  let total = 0;
  for (const valor of valores) {
    if (!finito(valor)) return null;
    total += valor;
  }
  return total;
}

/** Percentual de a sobre b. Devolve nulo — nunca NaN, nunca Infinity. */
export function percentual(a: number | null, b: number | null): number | null {
  if (!finito(a) || !finito(b) || b <= 0) return null;
  return (100 * a) / b;
}

/** Média por licitação. Zero licitações não é média zero: é sem média. */
export function ticketMedio(valor: number | null, quantidade: number | null): number | null {
  if (!finito(valor) || !finito(quantidade) || quantidade <= 0) return null;
  return valor / quantidade;
}

/**
 * Proporção para desenhar barra, entre 0 e 100.
 *
 * `null` quando não há como calcular, e `transbordo` quando passa de 100 — que
 * é sintoma de duplicidade de lote ou de revisão contada duas vezes, e precisa
 * aparecer, não ser aparado em silêncio.
 */
export function proporcaoDeBarra(a: number | null, b: number | null): { largura: number; transbordo: boolean } | null {
  const p = percentual(a, b);
  if (p === null) return null;
  return { largura: Math.max(0, Math.min(100, p)), transbordo: p > 100 };
}

export function totaisDoPeriodo(meses: readonly MesDoFunil[]): ResumoDoFunil {
  const etapas = etapasDoFunil.map((etapa): TotalDaEtapa => {
    const quantidade = meses.reduce((soma, mes) => soma + (mes.quantidade[etapa] ?? 0), 0);
    const valor = somaPreservandoAusencia(meses.map((mes) => mes.valor[etapa]));
    return {
      etapa,
      rotulo: rotuloDaEtapa[etapa],
      quantidade,
      valor,
      ticketMedio: ticketMedio(valor, quantidade),
    };
  });

  return {
    publicados: somaPreservandoAusencia(meses.map((mes) => mes.publicados)),
    etapas,
    meses,
  };
}

/**
 * Taxa de aproveitamento entre uma etapa e a anterior, mês a mês.
 *
 * ⚠️ Sempre pelos totais de cada mês, nunca pela média das taxas mensais — a
 * média simples pesa igual um mês de 300 licitações e um de 12.
 */
export function taxaMensal(
  meses: readonly MesDoFunil[],
  etapa: EtapaDoFunil,
  base: EtapaDoFunil,
): readonly (number | null)[] {
  return meses.map((mes) => percentual(mes.quantidade[etapa], mes.quantidade[base]));
}
