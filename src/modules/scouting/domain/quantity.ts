/**
 * Comparação de quantitativo entre o que o edital exige e o que a empresa já
 * executou.
 *
 * É a nuance que separa "temos acervo de ponte" de "temos acervo suficiente".
 * Ponte de 30 m cobre exigência de 15 m — mesmo serviço, quantitativo maior.
 * Isso se afirma, não se sinaliza: é a regra corrente de habilitação.
 *
 * ⚠️ Duas coisas que este módulo NÃO faz, de propósito:
 *
 * 1. Não inventa conversão entre dimensões diferentes. Metro linear não vira
 *    metro quadrado sem saber a largura, e chutar aqui produziria "atende" onde
 *    a comissão diria o contrário — com a proposta já paga.
 *
 * 2. Não aplica percentual mínimo próprio. O mínimo de parcela de maior
 *    relevância costuma ser 50%, mas varia por edital: ele tem de sair da
 *    leitura do edital, nunca de uma constante no código. O que chega aqui como
 *    `required` já é o mínimo exigido.
 *
 * A matriz de atendimento continua sendo o lugar da conversão auditável, com
 * fator, regra e fonte informados por uma pessoa. Aqui é triagem: serve para
 * ordenar a fila, não para sustentar recurso.
 */

/** Unidade canônica por dimensão. */
const canonical: Readonly<Record<string, { dimension: string; toBase: number }>> = {
  // comprimento — base metro
  mm: { dimension: "comprimento", toBase: 0.001 },
  cm: { dimension: "comprimento", toBase: 0.01 },
  m: { dimension: "comprimento", toBase: 1 },
  km: { dimension: "comprimento", toBase: 1000 },
  // área — base metro quadrado
  cm2: { dimension: "area", toBase: 0.0001 },
  m2: { dimension: "area", toBase: 1 },
  ha: { dimension: "area", toBase: 10_000 },
  km2: { dimension: "area", toBase: 1_000_000 },
  // volume — base metro cúbico
  l: { dimension: "volume", toBase: 0.001 },
  m3: { dimension: "volume", toBase: 1 },
  // massa — base quilograma
  kg: { dimension: "massa", toBase: 1 },
  t: { dimension: "massa", toBase: 1000 },
  // contagem
  un: { dimension: "contagem", toBase: 1 },
};

/** Como cada unidade aparece escrita em atestado e em edital. */
const aliases: Readonly<Record<string, string>> = {
  mm: "mm", milimetro: "mm",
  cm: "cm", centimetro: "cm",
  m: "m", ml: "m", "m linear": "m", metro: "m", metros: "m", "metro linear": "m",
  km: "km", quilometro: "km", "km linear": "km",
  cm2: "cm2",
  m2: "m2", "m²": "m2", "metro quadrado": "m2", "metros quadrados": "m2",
  ha: "ha", hectare: "ha", hectares: "ha",
  km2: "km2", "km²": "km2",
  l: "l", litro: "l", litros: "l",
  m3: "m3", "m³": "m3", "metro cubico": "m3", "metros cubicos": "m3",
  kg: "kg", quilo: "kg", quilograma: "kg",
  t: "t", ton: "t", tonelada: "t", toneladas: "t",
  un: "un", und: "un", unid: "un", unidade: "un", unidades: "un", pc: "un", peca: "un",
};

const semAcento = (texto: string) =>
  texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/**
 * Reduz a unidade escrita à forma canônica. Devolve `null` quando não reconhece
 * — o que é resposta legítima: verba, ponto, conjunto e serviço não se comparam
 * por número.
 */
export function normalizeUnit(unit: string | undefined): string | null {
  if (!unit) return null;
  // "m²" e "m³" perdem o expoente ao remover acento, então tratam-se antes.
  const bruto = unit.toLowerCase().trim().replace(/²/g, "2").replace(/³/g, "3");
  const limpo = semAcento(bruto).replace(/\.$/, "").replace(/\s+/g, " ");
  const direto = aliases[limpo] ?? (canonical[limpo] ? limpo : null);
  if (direto) return direto;
  // Plural por extenso: "quilômetros", "toneladas", "unidades". A forma curta
  // nunca termina em s, então tirar o s final não confunde m, km ou t.
  const singular = limpo.replace(/s$/, "");
  return aliases[singular] ?? (canonical[singular] ? singular : null);
}

export type Quantity = Readonly<{ value: number; unit: string }>;

/**
 * Lê "1.234,56 m²", "12 KM", "3500m3" e afins.
 *
 * Formato brasileiro: ponto separa milhar, vírgula separa decimal. Ler ao
 * contrário transformaria 1.500 m em 1,5 m — erro de mil vezes bem no número
 * que decide habilitação.
 */
export function parseQuantity(text: string | undefined): Quantity | null {
  if (!text) return null;
  // O dígito faz parte da unidade em m2 e m3: excluí-lo cortava "3500m3" em "m".
  const match = /(-?[\d.,]+)\s*([a-zA-Zçãáéíóúâêôµ²³]+[23]?(?:\s+[a-zA-Zçãáéíóúâêô]+)?)?/.exec(text.trim());
  if (!match?.[1]) return null;

  const bruto = match[1].replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const value = Number(bruto);
  if (!Number.isFinite(value) || value <= 0) return null;

  const unit = normalizeUnit(match[2]);
  return unit ? { value, unit } : null;
}

/** Converte para a unidade alvo, ou `null` quando as dimensões não batem. */
export function convert(quantity: Quantity, targetUnit: string): number | null {
  const origem = canonical[quantity.unit];
  const destino = canonical[targetUnit];
  if (!origem || !destino || origem.dimension !== destino.dimension) return null;
  return (quantity.value * origem.toBase) / destino.toBase;
}

export type QuantityVerdict = "COVERED" | "BELOW" | "INCOMPARABLE";

export type QuantityComparison = Readonly<{
  verdict: QuantityVerdict;
  required: Quantity;
  /** Maior atestado isolado, já convertido para a unidade exigida. */
  best?: number;
  /** Soma de todos os atestados do serviço, na unidade exigida. */
  total?: number;
  /** Quantos atestados puderam ser comparados. */
  comparable: number;
  /** Quantos foram ignorados por unidade incomparável. */
  ignored: number;
  explanation: string;
}>;

const numero = (valor: number, unidade: string) =>
  `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unidade}`;

/**
 * Confronta o quantitativo exigido com os do acervo.
 *
 * O veredito olha o MAIOR atestado isolado, e não a soma: nem todo edital
 * aceita somatório de atestados, e afirmar cobertura com base numa soma que a
 * comissão pode recusar é o erro caro. A soma vai junto, informada, para quem
 * for conferir o edital decidir.
 */
export function compareQuantity(
  required: Quantity,
  executed: readonly (Quantity | null)[],
): QuantityComparison {
  const convertidos = executed
    .map((item) => (item ? convert(item, required.unit) : null))
    .filter((valor): valor is number => valor !== null);
  const ignored = executed.length - convertidos.length;

  if (convertidos.length === 0) {
    return {
      verdict: "INCOMPARABLE",
      required,
      comparable: 0,
      ignored,
      explanation: executed.length === 0
        ? `sem quantitativo no acervo para comparar com ${numero(required.value, required.unit)}`
        : `acervo em unidade incomparável com ${required.unit}`,
    };
  }

  const best = Math.max(...convertidos);
  const total = convertidos.reduce((soma, valor) => soma + valor, 0);
  const cobre = best >= required.value;

  const explanation = cobre
    ? `maior atestado de ${numero(best, required.unit)} cobre os ${numero(required.value, required.unit)} exigidos`
    : total >= required.value
      ? `maior atestado tem ${numero(best, required.unit)}, abaixo dos ${numero(required.value, required.unit)} exigidos — somando os ${convertidos.length} atestados dá ${numero(total, required.unit)}, se o edital aceitar somatório`
      : `maior atestado tem ${numero(best, required.unit)} e a soma de todos dá ${numero(total, required.unit)}, contra ${numero(required.value, required.unit)} exigidos`;

  return {
    verdict: cobre ? "COVERED" : "BELOW",
    required,
    best,
    total,
    comparable: convertidos.length,
    ignored,
    explanation,
  };
}
