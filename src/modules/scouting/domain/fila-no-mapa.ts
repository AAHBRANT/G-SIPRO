/**
 * A fila do Buscador vista no mapa do Brasil (pedido do dono, 22/10/2026):
 * a mesma "Relação de rastreadas", só que cada licitação vira um ponto na
 * sede do município do órgão e cada estado é pintado pelo que tem na fila.
 *
 * Tudo aqui é conta pura sobre o que o servidor já filtrou — a tela não
 * decide quem entra na fila, só como mostrar.
 */

/** O que o navegador recebe de cada licitação: o mínimo para ponto, cor e ficha. */
export type PontoDaFila = Readonly<{
  id: string;
  subject: string;
  authorityName: string;
  cidade?: string;
  uf?: string;
  /** Ausente quando o órgão não revelou o orçamento. */
  valor?: number;
  sigiloso: boolean;
  /** Dias até o encerramento das propostas; ausente sem data publicada. */
  dias?: number;
  /** Encerramento em ISO, para a ficha mostrar a data. */
  encerramento?: string;
  /** % dos pré-requisitos atendidos — o mesmo número do medidor da linha. */
  score: number;
  atendidos: number;
  totalDeRequisitos: number;
  /** Posição no sistema do `VIEWBOX_DO_BRASIL`; ausente quando o município não casou. */
  x?: number;
  y?: number;
}>;

export type TotalDaUf = Readonly<{ quantidade: number; valor: number }>;

/** Prazo curto é o mesmo corte do cartão "Prazo curto" da fila. */
export const PRAZO_CURTO_DIAS = 14;
export const PRAZO_MEDIO_DIAS = 30;

export type FaixaDePrazo = "curto" | "medio" | "folgado" | "sem-data";

export function faixaDoPrazo(dias: number | undefined): FaixaDePrazo {
  if (dias === undefined) return "sem-data";
  if (dias <= PRAZO_CURTO_DIAS) return "curto";
  if (dias <= PRAZO_MEDIO_DIAS) return "medio";
  return "folgado";
}

/**
 * Quantidade e valor por UF. Licitação sem UF não pinta estado nenhum, e
 * valor sigiloso conta na quantidade mas nunca soma no valor — somar zero
 * faria o estado parecer mais barato do que é.
 */
export function totaisPorUf(pontos: readonly PontoDaFila[]): ReadonlyMap<string, TotalDaUf> {
  const totais = new Map<string, { quantidade: number; valor: number }>();
  for (const ponto of pontos) {
    if (!ponto.uf) continue;
    const atual = totais.get(ponto.uf) ?? { quantidade: 0, valor: 0 };
    atual.quantidade += 1;
    if (!ponto.sigiloso && ponto.valor !== undefined) atual.valor += ponto.valor;
    totais.set(ponto.uf, atual);
  }
  return totais;
}

export type GrupoNoMapa = Readonly<{ chave: string; x: number; y: number; pontos: readonly PontoDaFila[] }>;

/**
 * Licitações da mesma sede viram UM ponto — dez obras de Curitiba empilhadas
 * no mesmo pixel não se distinguem, e o número no ponto diz quantas são.
 * Quem não tem posição (município que não casou) fica de fora do desenho e
 * continua na lista e nos totais do estado.
 */
export function agruparPorCidade(pontos: readonly PontoDaFila[]): readonly GrupoNoMapa[] {
  const grupos = new Map<string, { chave: string; x: number; y: number; pontos: PontoDaFila[] }>();
  for (const ponto of pontos) {
    if (ponto.x === undefined || ponto.y === undefined) continue;
    const chave = `${ponto.x.toFixed(1)}|${ponto.y.toFixed(1)}`;
    const grupo = grupos.get(chave) ?? { chave, x: ponto.x, y: ponto.y, pontos: [] };
    grupo.pontos.push(ponto);
    grupos.set(chave, grupo);
  }
  return [...grupos.values()];
}

/**
 * O prazo que define a cor de um ponto agrupado é o MAIS curto do grupo:
 * a cidade com uma obra vencendo em 5 dias tem de aparecer em vermelho,
 * mesmo que as outras três de lá ainda tenham folga.
 */
export function prazoDoGrupo(grupo: GrupoNoMapa): number | undefined {
  const comData = grupo.pontos.map((ponto) => ponto.dias).filter((dias): dias is number => dias !== undefined);
  return comData.length > 0 ? Math.min(...comData) : undefined;
}
