import type { RequiredService } from "@/modules/scouting/domain/edital-requirement";

/**
 * Leitor das parcelas de maior relevância nos formatos que o leitor de tabela
 * "100%" e o de lista com "•" não reconhecem (pedido do dono, 22/10/2026:
 * "ensina essa leitura").
 *
 * Calibrado contra 134 licitações reais de obra abertas no PNCP (a mesma fila
 * do Buscador). Antes dele, o quantitativo saía em 1% delas. Os formatos
 * vieram desse corpus, não de suposição:
 *
 * - LINHA DE TABELA ACHATADA (a extração do PDF junta as colunas numa frase).
 *   O fim de cada linha é sempre uma combinação de número e unidade:
 *     "… 530,00 m 212,00 m"            total, mínimo — vale o 2º
 *     "… 9.558 m² 3.823 m²"            idem
 *     "… M 5.000,00 1.500,00 (30%)"    unidade antes, total, mínimo
 *     "… m³ 29.160,00"                 unidade antes, só o mínimo
 *     "… 2.355,00 m²"                  só o mínimo
 *     "… 98,90 km ext ≥ 49,00 km"      quadro do DNIT: vale o depois de "≥"
 * - FRASE COM ÂNCORA: "em quantidade não inferior a 490,00 m",
 *   "quantidade mínima de 750 m³", "no mínimo, 650,00 m", "em quantitativo
 *   mínimo de 1.200 m²", "Quantidade mínima exigida para comprovação: 828,23 t".
 * - LISTA "descrição: quantidade unidade;".
 *
 * Só lê DENTRO da seção de qualificação técnico-operacional / parcelas de
 * maior relevância. Fora dela o mesmo padrão casaria a planilha orçamentária
 * inteira — e trazer o orçamento para a exigência já foi recusado pelo dono.
 */

const NUM = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?`;

/** Unidades que medem parcela. `mm`, `cm`, `MPa` só aparecem em descrição. */
const UNIDADES: ReadonlyArray<Readonly<{ re: RegExp; unit: string }>> = [
  { re: /^m\s?[³3]\s?x\s?k\s?m$/i, unit: "m³xkm" },
  { re: /^m\s?[²2]$/i, unit: "m²" },
  { re: /^m\s?[³3]$/i, unit: "m³" },
  { re: /^km$/i, unit: "km" },
  { re: /^kg$/i, unit: "kg" },
  { re: /^(?:t|ton|toneladas?)$/i, unit: "t" },
  { re: /^(?:un|und|unid)$/i, unit: "un" },
  { re: /^kva$/i, unit: "kVA" },
  { re: /^kwp$/i, unit: "kWp" },
  { re: /^unidades$/i, unit: "un" },
  { re: /^m$/i, unit: "m" },
];
const UNIDADE_TEXTO = String.raw`m\s?[³3]\s?x\s?k\s?m|m\s?[²2]|m\s?[³3]|km(?:\s+ext\.?)?|kg|kva|kwp|toneladas?|ton|t|unidades|und|unid|un|m`;

const unidadeDe = (texto: string): string | undefined => {
  const limpo = texto.replace(/\s+ext\.?$/i, "").trim();
  return UNIDADES.find((u) => u.re.test(limpo))?.unit;
};

/** "1.792,41" → 1792.41; "7.219" (milhar) → 7219. */
export function numeroBR(texto: string): number {
  const t = texto.trim();
  const valor = /,/.test(t) ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t.replace(/\./g, ""));
  return valor;
}

/** Ruído de página e de quebra que a extração do PDF intercala no meio das tabelas. */
export function limparTexto(texto: string): string {
  return texto
    // Espaços primeiro: os reparos abaixo contam com UM espaço entre pedaços,
    // e o PDF real costuma trazer vários ("28.961,4 5   9,65%").
    .replace(/\s+/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    // Tensão não é potência: "11,4 kV" não pode virar parcela em kVA — nem
    // quando a extração parte o número ("1 1,4kV").
    .replace(/(\d)\s(\d,\d+)\s*kV(?![A-Za-z])/g, "$1$2kV")
    .replace(/(\d)\s*kV(?![A-Za-z])/g, "$1 quilovolts")
    // "(Quantidade: 4841 metros)": a palavra por extenso vira a unidade.
    .replace(/(quantidade\s*:\s*[\d.,]+)\s*metros?\b/gi, "$1 m")
    .replace(/\S+@\S+\.\S+/g, " ")
    .replace(/P\s?á\s?g\s?i\s?n\s?a\s+\d+\s*\|\s*\d+/gi, " ")
    .replace(/P[áa]gina\s+\d+\s+de\s+\d+/gi, " ")
    // Endereço de rodapé: "Rod. TO-010, km 1, lote 11" viraria parcela de 1 km.
    .replace(/\bRod(?:ovia)?\.?\s*[A-Z]{2}-?\d{2,3},?\s*km\s*\d+(?:[,.]\d+)?/gi, " ")
    .replace(/\bCEP\.?:?\s*\d{2}\.?\d{3}-?\d{3}/gi, " ")
    .replace(/\b(?:HASH|C[óo]digo verificador|CRC)\b:?\s*\S+/gi, " ")
    // Expoente separado da unidade: "m ²", "m ³".
    .replace(/\b([mM])\s+([²³])/g, "$1$2")
    .replace(/\b(M3)\s*X\s*K\s*M\b/gi, "M3XKM")
    // Glosa depois da unidade: "m³ (metros cúbicos) 11.924,50", "T (toneladas)".
    .replace(/\(\s*(?:metros?(?:\s+c[úu]bicos|\s+quadrados|\s+lineares)?|toneladas?|quil[ôo]metros?|unidades?)\s*\)/gi, " ")
    // Linha qualitativa não tem quantidade: vira separador de linha.
    .replace(/\b(?:QUALITATIV[OA]S?)\b(?:\s+QUALITATIV[OA]S?\b)*/gi, " ; ")
    // Número partido pela extração: "3. 241,60" e "11.151,4 9 m".
    .replace(/(\d)\.\s(\d{3}(?:,\d+)?)(?!\d)/g, "$1.$2")
    .replace(/(\d,\d+)\s(\d)(?=\s?(?:m|t|kg|km|un)\b|\s\d+(?:,\d+)?\s?%)/gi, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

type Token =
  | Readonly<{ k: "num"; v: number; ini: number; fim: number }>
  | Readonly<{ k: "un"; u: string; ini: number; fim: number }>
  | Readonly<{ k: "pct" | "ge" | "rs"; ini: number; fim: number }>
  | Readonly<{ k: "w"; t: string; ini: number; fim: number }>;

const TOKEN = new RegExp(
  [
    String.raw`(?<rs>R\$\s*(?:${NUM}))`,
    String.raw`(?<pct>\(?\s*(?:${NUM})\s*%\s*\)?)`,
    String.raw`(?<ge>≥|>=)`,
    String.raw`(?<num>(?:${NUM}))(?![\d%])`,
    String.raw`(?<un>(?<![A-Za-zÀ-ÿ])(?:${UNIDADE_TEXTO})(?![A-Za-zÀ-ÿ0-9]))`,
    String.raw`(?<w>[^\s]+)`,
  ].join("|"),
  "gi",
);

function tokens(texto: string): Token[] {
  const lista: Token[] = [];
  for (const m of texto.matchAll(TOKEN)) {
    const g = m.groups!;
    const ini = m.index!;
    const fim = ini + m[0].length;
    if (g.rs) lista.push({ k: "rs", ini, fim });
    else if (g.pct) lista.push({ k: "pct", ini, fim });
    else if (g.ge) lista.push({ k: "ge", ini, fim });
    else if (g.num) lista.push({ k: "num", v: numeroBR(g.num), ini, fim });
    else if (g.un) {
      const u = unidadeDe(g.un);
      lista.push(u ? { k: "un", u, ini, fim } : { k: "w", t: g.un, ini, fim });
    } else lista.push({ k: "w", t: g.w!, ini, fim });
  }
  return lista;
}

// ---------------------------------------------------------------------------
// Linha de tabela achatada
// ---------------------------------------------------------------------------

type Cauda = Readonly<{ ini: number; fim: number; quantidade: number; unidade: string; tamanho: number }>;

/**
 * O mínimo é uma fração do total (30% a 60% na prática). Um "segundo número"
 * muito menor que o primeiro quase sempre é o número do item da linha
 * seguinte ("… 2.355,00 m² 2 Execução de …"), e não o mínimo.
 */
const pareceMinimo = (total: number, minimo: number) => minimo <= total && minimo >= total * 0.05;

/**
 * O "mínimo" que é número do item seguinte: "03" com zero à esquerda (lista
 * de equipamentos) ou inteiro solto depois de um total com casas decimais
 * ("M 32,00 3 Concretagem").
 */
function minimoSuspeito(texto: string, total: Extract<Token, { k: "num" }>, minimo: Extract<Token, { k: "num" }>): boolean {
  const bruto = texto.slice(minimo.ini, minimo.fim);
  return /^0\d/.test(bruto)
    || (/^\d{1,2}$/.test(bruto) && /,/.test(texto.slice(total.ini, total.fim)))
    // "m 59 8.17.2.4": o "mínimo" é o começo da numeração do subitem.
    || /^\.\s?\d/.test(texto.slice(minimo.fim, minimo.fim + 3));
}

/**
 * Medida que é CARACTERÍSTICA do serviço, não a parcela: "DMT ATÉ 30 KM",
 * "D = 2,60 M", "seção mínima 3,0 m", "espessura de 8 cm", "caminhão
 * basculante de 6 m³". Só vale para a cauda de um número só — a de dois
 * números (total e mínimo) é coluna de tabela, não medida solta.
 */
const MEDIDA_DE_CARACTERISTICA = /(?:=|<|\bx|ø|\bat[ée]|inferior\s+a|m[íi]nim[ao](?:\s+de)?|m[áa]xim[ao](?:\s+de)?|espessura(?:\s+de)?|di[âa]metro(?:\s+(?:interno|externo|nominal))?(?:\s+de)?|se[çc][ãa]o(?:\s+[^\s\d]+){0,3}?(?:\s+de)?|largura(?:\s+de)?|altura(?:\s+de)?|comprimento(?:\s+de)?|dmt(?:\s+de)?|basculante\s+de|capacidade(?:\s+[^\s\d]+){0,5}?:?(?:\s+de)?|ca[çc]amba(?:\s+de)?|dosadora(?:\s+de)?|compreendendo|totalizando|perfazendo|\d\s+a|dist[âa]ncia(?:\s+\S+)?(?:\s+de)?|l[âa]mpada(?:\s+\S+)?|raio(?:\s+de)?|recalque(?:\s+de)?|[áa]rea\s+total(?:\s+de)?|totaliza(?:m|ndo)?|or[çc]ad[ao]s?|a\s+ser\s+contratada:?|vão\s+de|\bdn)\s*$/i;

/** Quantidade que descreve um rendimento ("30 m³/h"), não uma obra executada. */
const POR_TEMPO = /^\s*\/\s*(?:h|s|min|dia|m[êe]s)\b/i;

/** Reconhece o fim de linha que começa no token `i`. */
function caudaEm(t: readonly Token[], i: number, texto: string): Cauda | undefined {
  const a = t[i], b = t[i + 1], c = t[i + 2], d = t[i + 3], e = t[i + 4];
  const comPercentual = (k: number) => t[k]?.k === "pct";
  // DNIT: TOTAL UN ≥ MIN [UN]
  if (a?.k === "num" && b?.k === "un" && c?.k === "ge" && d?.k === "num") {
    const comUn = e?.k === "un";
    return { ini: a.ini, fim: (comUn ? e : d).fim, quantidade: d.v, unidade: comUn ? e.u : b.u, tamanho: comUn ? 5 : 4 };
  }
  // TOTAL UN MIN UN
  if (a?.k === "num" && b?.k === "un" && c?.k === "num" && d?.k === "un" && (pareceMinimo(a.v, c.v) || comPercentual(i + 4))) {
    return { ini: a.ini, fim: d.fim, quantidade: c.v, unidade: d.u, tamanho: 4 };
  }
  // UN TOTAL MIN — "(3,75%)" logo depois confirma o mínimo mesmo pequeno.
  if (a?.k === "un" && b?.k === "num" && c?.k === "num" && !minimoSuspeito(texto, b, c) && (pareceMinimo(b.v, c.v) || (c.v <= b.v && comPercentual(i + 3)))) {
    return { ini: a.ini, fim: c.fim, quantidade: c.v, unidade: a.u, tamanho: 3 };
  }
  // TOTAL UN MIN (mínimo sem unidade, herda a do total)
  if (a?.k === "num" && b?.k === "un" && c?.k === "num" && d?.k !== "un" && !minimoSuspeito(texto, a, c) && (pareceMinimo(a.v, c.v) || (c.v <= a.v && comPercentual(i + 3)))) {
    return { ini: a.ini, fim: c.fim, quantidade: c.v, unidade: b.u, tamanho: 3 };
  }
  // UN TOTAL PCT MIN: "m³ 2.000,00 7,5% 1.000,00" — o % é do valor, o mínimo vem depois.
  if (a?.k === "un" && b?.k === "num" && c?.k === "pct" && d?.k === "num" && d.v <= b.v && d.v >= b.v * 0.05) {
    return { ini: a.ini, fim: d.fim, quantidade: d.v, unidade: a.u, tamanho: 4 };
  }
  const antes = texto.slice(Math.max(0, (a?.ini ?? 0) - 40), a?.ini ?? 0);
  // Cauda de um número só: o número precisa ser quantidade de verdade — nem
  // numeração de item ("M2 1.6.1.0.4."), nem "03" de lista de equipamento,
  // nem característica do serviço, nem rendimento por hora.
  const quantidadeDeVerdade = (n: Extract<Token, { k: "num" }>, depois: number) => {
    const bruto = texto.slice(n.ini, n.fim);
    return !/^0\d/.test(bruto)
      // Numeração de subitem: "25.4 Comprovação", "25. 4", "8.17.2.4".
      && !/^\.\s?\d/.test(texto.slice(n.fim, n.fim + 3))
      && !/\d\.$/.test(texto.slice(Math.max(0, n.ini - 2), n.ini))
      // Código de material colado ao número: "aço CA-50 kg" não é 50 kg.
      && !/\b[A-Z]{1,3}-\s?$/.test(texto.slice(Math.max(0, n.ini - 6), n.ini))
      && !POR_TEMPO.test(texto.slice(depois, depois + 6))
      && !/^\s*quilovolts/.test(texto.slice(n.fim, n.fim + 12));
  };
  // UN seguido de inteiro pequeno sem casas ("M2 25 Comprovação", "KG 2
  // ATERRO", "T 8, base"): é o índice da linha seguinte da tabela sem coluna
  // de quantidade. Exigência de m², m³, kg e t vem com decimal ou milhar.
  // Só é índice quando vem colado na descrição seguinte ("KG 2 ATERRO"); em
  // "m 76 2 Estaca raiz" o 76 é a quantidade e o 2 é que é o índice.
  const indiceDaProximaLinha = (u: string, n: Extract<Token, { k: "num" }>) =>
    u !== "un" && /^\d{1,2}$/.test(texto.slice(n.ini, n.fim)) && /^\s*[A-Za-zÀ-ÿ]/.test(texto.slice(n.fim, n.fim + 4));
  // UN QTD
  if (a?.k === "un" && b?.k === "num" && quantidadeDeVerdade(b, b.fim) && !indiceDaProximaLinha(a.u, b) && !MEDIDA_DE_CARACTERISTICA.test(antes)) {
    return { ini: a.ini, fim: b.fim, quantidade: b.v, unidade: a.u, tamanho: 2 };
  }
  // QTD UN
  if (a?.k === "num" && b?.k === "un" && quantidadeDeVerdade(a, b.fim) && !MEDIDA_DE_CARACTERISTICA.test(antes)) {
    return { ini: a.ini, fim: b.fim, quantidade: a.v, unidade: b.u, tamanho: 2 };
  }
  return undefined;
}

/** Palavras de cabeçalho de tabela: a descrição da 1ª linha começa depois delas. */
const CABECALHO = /percentual\s+exigido|(?:quant(?:idade|\.)?\s+)?estimad[ao]\s*(?:\d+\s*%)?|%\s*da\s*(?:qtde?|quantidade)\.?\s*total|(?:quantidade|quant\.?|qtd\.?|qtde\.?)\s*(?:m[íi]nima|a ser comprovada|exigida|de planilha|prevista(?: na obra)?|pretendida|total|or[çc]ada)?[^A-Za-zÀ-ÿ]*(?:\(?\s*\d+\s*%\s*\)?)?|extens[ãa]o (?:a ser comprovada|do lote pretendido|total)[^A-Za-zÀ-ÿ]*|\bunid(?:ade)?\.?\b|\bund\.?\b|\bdescri[çc][ãa]o(?: dos servi[çc]os)?\b|\bservi[çc]os?\b(?= )|\bparcelas? de maior relev[âa]ncia(?: t[ée]cnica)?\b|\bitem\b|\blote\b|valor \(r\$\)|% do valor estimado/gi;

const DESCARTAR = /qualitativ|quantidade de atestados|^total\s*$|total geral|engenheir|pontua[çc]|capital social|patrim[ôo]nio|dist[âa]ncia\s+m[áa]xima/i;

function limparDescricao(bruta: string): string {
  let d = bruta;
  // Cabeçalho repetido (1ª linha ou depois de quebra de página): fica o que
  // vem depois da última palavra de cabeçalho.
  const cab = [...d.matchAll(CABECALHO)];
  if (cab.length >= 2) {
    const ultimo = cab[cab.length - 1]!;
    d = d.slice(ultimo.index! + ultimo[0].length);
  }
  // Linha anterior encerrada por ";" (inclusive a qualitativa, que a limpeza
  // transforma em ";"): a descrição é o que vem depois.
  d = d.replace(/^.*;\s*/, "");
  // Sobra de colunas e títulos que a extração cola no começo da linha:
  // "NÃO*" / "SIM" (coluna "aceita somatório de atestados"), o próprio
  // cabeçalho "ITENS DE MAIOR RELEVÂNCIA TÉCNICA" e título de grupo
  // ("Serviços complementares: 07").
  for (let antes = ""; antes !== d;) {
    antes = d;
    d = d
      .replace(/^\s*(?:(?:sim|n[ãa]o)\s*\*?|aceita\s+somat[óo]rio(?:\s+de\s+atestados)?\s*\??)\s+/i, "")
      .replace(/^\s*(?:itens|parcelas|servi[çc]os)\s+de\s+maior\s+relev[âa]ncia(?:\s+t[ée]cnica)?(?:\s+e\s+valor\s+significativo)?\s*:?\s*/i, "")
      .replace(/^\s*[A-Za-zÀ-ÿ ]{3,40}:\s*\d{1,2}\s+(?=[A-Za-zÀ-ÿ])/, "");
  }
  // Introdução terminada em ":" seguida de marcador de lista ("•", "" do Word).
  d = d.replace(/^.*:\s*(?=[•\uf0b7▪●])/, "").replace(/^[\s•\uf0b7▪●◦]+/, "");
  // Marcador de item ou de lote no começo: "1", "01", "1.1", "IV", "a)", "4 ".
  d = d.replace(/^(?:[\s–—\-:;,.]*(?:[a-z]\.\d{1,2}(?:\.\d{1,2})*|\d{1,2}(?:\.\d{1,2})*|[IVXL]{1,5}|[a-z])[).\-–—]?\s+)+/i, "");
  return d.replace(/^[\s–—\-:;,.]+|[\s–—\-:;,]+$/g, "").replace(/\s+/g, " ").trim();
}

const descricaoValida = (d: string) =>
  d.length >= 8 && d.length <= 420 && (d.match(/[A-Za-zÀ-ÿ]{3,}/g) ?? []).length >= 2 && !DESCARTAR.test(d);

/** Linhas de tabela achatada dentro de um trecho já limpo. */
export function parcelasEmTabelaAchatada(trecho: string): RequiredService[] {
  const t = tokens(trecho);
  // Tabela com coluna total+mínimo: cauda de um número só, COLADA na unidade ("cimento 50kg"), é medida da descrição.
  let duplas = 0, simples = 0;
  for (let k = 0; k < t.length;) { const c = caudaEm(t, k, trecho); if (c && c.tamanho >= 3) { duplas += 1; k += c.tamanho; } else if (c) { simples += 1; k += c.tamanho; } else k += 1; }
  const tabelaDeDuasColunas = duplas >= 2 && duplas > simples;
  const colada = (c: Cauda) => /^\d[\d.,]*[A-Za-z]/.test(trecho.slice(c.ini, c.fim));
  const parcelas: RequiredService[] = [];
  let inicioDaDescricao = 0;
  let i = 0;
  while (i < t.length) {
    const cauda = caudaEm(t, i, trecho);
    if (!cauda || (tabelaDeDuasColunas && cauda.tamanho < 3 && colada(cauda))) { i += 1; continue; }
    // Pula o que acompanha a cauda e ainda é da mesma linha: "(30%)",
    // "R$ 35.175.733,03", o valor sem "R$" e o "75,77%" das colunas de
    // valor — até a primeira palavra, que já é a linha seguinte.
    let j = i + cauda.tamanho;
    while (t[j] && (t[j]!.k === "pct" || t[j]!.k === "rs" || (t[j]!.k === "num" && (t[j + 1]?.k === "pct" || t[j + 1]?.k === "num" || t[j + 1]?.k === "rs")))) j += 1;
    const descricao = limparDescricao(trecho.slice(inicioDaDescricao, cauda.ini));
    if (descricaoValida(descricao) && cauda.quantidade > 0) {
      parcelas.push({ description: descricao, quantity: cauda.quantidade, unit: cauda.unidade });
    }
    inicioDaDescricao = t[j - 1]!.fim;
    i = j;
  }
  return parcelas;
}

// ---------------------------------------------------------------------------
// Frase com âncora e lista "descrição: quantidade unidade;"
// ---------------------------------------------------------------------------

const QTD_UN = String.raw`(${NUM})\s*(${UNIDADE_TEXTO})(?![A-Za-zÀ-ÿ0-9])`;
const ANCORAS_DE_MINIMO = [
  String.raw`quantidade\s+m[íi]nima\s+exigida\s+para\s+comprova[çc][ãa]o\s*:?\s*`,
  String.raw`quantidade\s+m[íi]nima\s*:?\s*(?:de\s+)?`,
  String.raw`(?:em\s+)?quantitativo\s+m[íi]nimo\s+de\s+`,
  String.raw`(?:em\s+quantidade\s+)?n[ãa]o\s+inferior\s+a\s+`,
  String.raw`igual\s+ou\s+superior\s+a\s+`,
  // "(Quantidade: 831,42 m³)" ou "… in loco”. Quantidade : 26 unidades",
  // logo depois da descrição do item.
  String.raw`(?:\(|(?<=[.;”"]\s))\s*quantidade\s*:\s*`,
  // "(?<!\p{L})": "interno mínimo de 3,00 m" não é "no mínimo".
  String.raw`(?<![A-Za-zÀ-ÿ])no\s+m[íi]nimo,?\s+`,
  String.raw`ou\s+seja,?\s+`,
  String.raw`[áa]rea\s+(?:n?o\s+)?m[íi]nim[ao]\s+(?:de\s+)?`,
];
const FRASE = new RegExp(String.raw`(?:${ANCORAS_DE_MINIMO.join("|")})${QTD_UN}`, "gi");
/** Onde começa um item na prosa: "a)", "b)", "1-", "2 ", "II.", "9.34.1.1.", ";". */
const INICIO_DE_ITEM = /(?:^|[;.]\s+|\s)(?:[a-z]\.\d{1,2}(?:\.\d{1,2})*\)|[a-z]\)|\d{1,2}\s?[-–)]|\d{1,2}(?:\.\d{1,2}){1,6}\.?|[IVX]{1,4}[.)-])\s+|;\s*/gi;

export function parcelasEmFrase(trecho: string): RequiredService[] {
  const parcelas: RequiredService[] = [];
  let fimDoAnterior = 0;
  for (const m of trecho.matchAll(FRASE)) {
    const unidade = unidadeDe(m[2]!);
    if (!unidade) continue;
    if (JUSTIFICATIVA.test(trecho.slice(Math.max(0, m.index! - 80), m.index))) continue;
    // Linha de quadro de pontuação: "com área mínima de 10.000m². 1 5" — as
    // duas notas (por atestado, máxima) logo depois da medida.
    if (/^\.?\s+\d{1,2}\s+\d{1,2}(?!\d|[.,]\d)/.test(trecho.slice(m.index! + m[0].length, m.index! + m[0].length + 10))) continue;
    // A descrição é o item em que a âncora está: do último marcador de item
    // (ou do fim da frase anterior) até a âncora.
    // "Quantidade a ser contratada: 1.656,46 t" é o TOTAL, que vem antes do
    // mínimo no mesmo item: sai antes de procurar onde o item começa.
    const antes = trecho.slice(fimDoAnterior, m.index).replace(new RegExp(String.raw`[;.]?\s*quantidade\s+a\s+ser\s+contratada\s*:?\s*${QTD_UN}\s*$`, "i"), "");
    let inicio = 0;
    for (const marca of antes.matchAll(INICIO_DE_ITEM)) inicio = marca.index! + marca[0].length;
    const descricao = limparDescricao(
      antes.slice(inicio)
        .replace(/(?:[–—\-,]\s*)?(?:em\s+quantidade|com|considerando|fornecimento e assentamento de|correspondente a|sendo)\s*,?\s*$/i, "")
        .replace(/quantidade a ser contratada:.*$/i, ""),
    );
    if (descricaoValida(descricao)) parcelas.push({ description: descricao, quantity: numeroBR(m[1]!), unit: unidade });
    fimDoAnterior = m.index! + m[0].length;
  }
  return parcelas;
}

const LOTE_PCT = new RegExp(String.raw`\bLOTE\s*(\d{1,2})\s*[=:–-]\s*(${NUM})\s*(${UNIDADE_TEXTO})(?![A-Za-zÀ-ÿ0-9])[\s.]*(\d{1,3}(?:,\d+)?)\s*%\s*d[eo]\s*(${NUM})\s*(${UNIDADE_TEXTO})(?![A-Za-zÀ-ÿ0-9])`, "gi");
export function parcelasPorLote(trecho: string): RequiredService[] {
  const r: RequiredService[] = [];
  for (const m of trecho.matchAll(LOTE_PCT)) {
    const u = unidadeDe(m[3]!); const q = numeroBR(m[2]!); const p = numeroBR(m[4]!); const tot = numeroBR(m[5]!);
    if (!u || u !== unidadeDe(m[6]!) || Math.abs(q - tot * p / 100) > Math.max(0.05, tot * 0.005)) continue;
    r.push({ description: `Lote ${m[1]!.padStart(2, "0")} – área construída mínima (${p}% de ${m[5]} ${u})`, quantity: q, unit: u });
  }
  return r;
}

export function parcelasEmListaComDoisPontos(trecho: string): RequiredService[] {
  const parcelas: RequiredService[] = [];
  for (const item of trecho.split(/;/)) {
    const m = new RegExp(String.raw`^(.*):\s*${QTD_UN}\s*\.?\s*$`, "i").exec(item.trim());
    if (!m) continue;
    const unidade = unidadeDe(m[3]!);
    const descricao = limparDescricao(m[1]!.replace(/^.*(?:abaixo|seguintes?)\s*:/i, ""));
    if (unidade && descricaoValida(descricao)) parcelas.push({ description: descricao, quantity: numeroBR(m[2]!), unit: unidade });
  }
  return parcelas;
}

// ---------------------------------------------------------------------------
// Onde procurar
// ---------------------------------------------------------------------------

const ANCORA_DA_SECAO = /parcelas?\s+(?:considerad[ao]s?\s+)?(?:de\s+)?(?:maior|mais)\s+relev[âa]n(?:cia|tes?)|quantidades\s+m[íi]nimas|aptid[ãa]o\s+t[ée]cnico[\s-]*operacional|complexidade\s+tecnol[óo]gica\s+e\s+operacional|comprova[çc][ãa]o\s+de\s+forma\s+quantitativa|certid[ãa]o\s+de\s+acervo\s+operacional|itens? de maior relev[âa]ncia|servi[çc]os? de maior relev[âa]ncia|qualifica[çc][ãa]o t[ée]cnico[\s-]*operacional|capacidade t[ée]cnico[\s-]*operacional|capacidade t[ée]cnica operacional|quantitativos? m[íi]nimos?|quantidade m[íi]nima|a ser comprovad[ao]|crit[ée]rio de aceita[çc][ãa]o/gi;
const FIM_DA_SECAO = /comprova[çc][ãa]o\s+de\s+forma\s*(?:qualitativa|;)|qualifica[çc][ãa]o t[ée]cnico[\s-]*profissional|capacidade t[ée]cnico[\s-]*profissional|qualifica[çc][ãa]o econ[ôo]mico|observa[çc][õo]es\s*:|quantidade de atestados|da subcontrata[çc][ãa]o|planilha or[çc]ament[áa]ria sint[ée]tica|tabela de pontua[çc][ãa]o|proposta t[ée]cnica|crit[ée]rios? de julgamento|rela[çc][ãa]o de m[áa]quinas|discrimina[çc][ãa]o\s+(?:dos\s+)?equipamentos|rela[çc][ãa]o\s+(?:de|dos)\s+equipamentos|aparelhamento\s+(?:t[ée]cnico|m[íi]nimo)|estudo t[ée]cnico preliminar/i;

/**
 * Tabela sem coluna de quantidade (a do técnico-profissional, a de serviços
 * do objeto) não é exigência de acervo: o "número" depois da unidade é o
 * item seguinte. Medido no corpus: 24 parcelas inventadas assim.
 */
const CABECALHO_DE_QUANTIDADE = /quant|qtd|qtde|m[íi]nim|exigid|comprov|solicitad|≥|>=|extens[ãa]o/i;

/**
 * Cabeçalho de TABELA de verdade: duas colunas lado a lado ("Unid. Quant.",
 * "Quantidade prevista … Quantidade mínima", "Extensão … a ser comprovada").
 * Só com ele a tabela pode passar por cima da frase — números soltos de uma
 * justificativa ("compreendendo 660,82 m de BSTC") também formam "linhas", e
 * deixá-los vencer apagava as exigências "não inferior a" do mesmo edital.
 */
const CABECALHO_DE_TABELA = /(?:unid(?:ade)?\.?|und\.?|\bun\b)\s+(?:quant|qtd|qtde)|(?:quant|qtd|qtde)[^.;:]{0,60}(?:quant|qtd|qtde|m[íi]nim|exigid|comprovad)|extens[ãa]o[^.;:]{0,60}(?:a ser comprovada|m[íi]nima)|pretendid[ao][^.;:]{0,40}a ser comprovad/i;

/**
 * Quadro de PONTUAÇÃO da proposta técnica (técnica e preço): faixas "≥ X e
 * < Y" e conceitos Ótimo/Bom/Regular. Não é exigência de habilitação — no
 * corpus, 40 parcelas inventadas vinham daí.
 */
const QUADRO_DE_PONTUACAO = /(?:(?<!n[ãa]o\s)\be\s+inferior\s+[aà]\b[^]{0,300}){3}|(?:(?:≥|>=|superior\s+[aà])[^<;]{0,60}(?:<|inferior\s+[aà])[^;]{0,200}){2}|\(N[1-4]\)|\b(?:[óo]tim[ao]|insuficiente)\b[^.;]{0,80}\b(?:bo[am]|ruim|regular)\b|(?:\d+(?:,\d+)?\s+pontos?\b[^]{0,300}){2}|pontua[çc][ãa]o\s+m[áa]xima|(?:\b\d,\d0\s+\d{1,2},\d0\b[^]{0,300}){2}|(?:<\s*[\d.,]+\s*(?:m²|m³|m|km|t)?\s+at[ée]\s+[\d.,]+[^]{0,300}){2}/i;
/** Tabela de habilitação de verdade nunca cai pelo quadro de pontuação que vem logo depois. */
const TABELA_DE_HABILITACAO = /quantidade\s+m[íi]nima\s+exigida|qtd\.?\s+total[^.;]{0,40}m[íi]nima|quant(?:idade|\.)?\s+m[íi]nima\s+a\s+(?:ser\s+)?comprova/i;

/**
 * Justificativa repete números que não são exigência: "compreendendo 660,82 m
 * de BSTC e 91,02 m de …", "correspondente a 485,13 toneladas", "quantitativo
 * total de 28.961,45 m²". Sai da leitura o trecho a partir dessas palavras até
 * o fim da frase — a exigência que vem ANTES delas na mesma frase fica.
 */
const TRECHO_DE_JUSTIFICATIVA = new RegExp(
  // Só quando o gatilho vem SEGUIDO DE NÚMERO: "compreendendo 660,82 m de
  // BSTC" é justificativa; "compreendendo infraestrutura … com potência
  // instalada igual ou superior a 1.500 kVA" é a própria exigência.
  String.raw`\b(?:compreendendo|totalizando|totalizam|perfazendo|correspondente\s+a|quantitativo\s+total\s+de|quantidade\s+total(?:\s+de)?)\b(?=\s+(?:aproximadamente\s+|cerca\s+de\s+)?\d).*?` +
  // Termina no fim da frase OU no fim da célula da tabela achatada (unidade
  // seguida de número, ou índice da próxima linha) — sem isso o corte
  // engolia o mínimo da linha e a linha seguinte inteira.
  String.raw`(?=\.\s|;|$|\s(?:m²|m³|m2|m3|m|t|kg|km|un)\s+\d|\s\d{1,2}\s+[A-ZÀ-Ú][a-zà-ú])`,
  "gi",
);

/** "obtém-se o quantitativo mínimo de 831,22 m" é a justificativa repetindo o número. */
const JUSTIFICATIVA = /(?:obt[ée]m-se|resultando|resulta(?:ndo)?\s+(?:em|no)|correspond(?:e|ente)|equivale(?:nte)?|ou\s+seja,?\s+50%|calculad[ao])[^;.]{0,60}$/i;
const TAMANHO_DA_JANELA = 4_500;
/** Mais linhas que isto numa janela é orçamento, não exigência de acervo. */
const MAX_PARCELAS = 14;

const chave = (s: RequiredService) => `${s.description.toLowerCase().replace(/\s+/g, " ").slice(0, 80)}|${s.quantity}|${s.unit}`;

function semRepetir(lista: readonly RequiredService[]): RequiredService[] {
  const vistos = new Set<string>();
  return lista.filter((s) => {
    const k = chave(s);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/**
 * Procura a seção de exigência técnico-operacional e devolve as parcelas do
 * trecho que rende mais. Vazio quando nenhuma janela traz parcela com
 * quantitativo — e aí quem chamou segue com o que já tinha.
 */
export function parcelasPorPadrao(textoBruto: string): RequiredService[] {
  const texto = limparTexto(textoBruto);
  let melhor: RequiredService[] = [];
  const porLote = semRepetir(parcelasPorLote(texto));
  if (porLote.length >= 2 && porLote.length <= MAX_PARCELAS) return porLote;
  for (const ancora of texto.matchAll(ANCORA_DA_SECAO)) {
    const ini = ancora.index!;
    // Âncora citada dentro da regra de subcontratação não é a exigência.
    if (/subcontrat/i.test(texto.slice(Math.max(0, ini - 250), ini))) continue;
    let janela = texto.slice(ini, ini + TAMANHO_DA_JANELA);
    const fim = FIM_DA_SECAO.exec(janela.slice(60));
    if (fim) janela = janela.slice(0, 60 + fim.index);
    if (QUADRO_DE_PONTUACAO.test(janela) && !TABELA_DE_HABILITACAO.test(janela)) continue;
    janela = janela.replace(TRECHO_DE_JUSTIFICATIVA, " ");

    const lista = escolher(
      semRepetir(parcelasEmFrase(janela)),
      semRepetir(parcelasEmListaComDoisPontos(janela)),
      CABECALHO_DE_QUANTIDADE.test(janela.slice(0, 1_200)) ? semRepetir(parcelasEmTabelaAchatada(janela)) : [],
      CABECALHO_DE_TABELA.test(janela.slice(0, 1_500)),
    );
    if (lista.length > melhor.length) melhor = lista;
  }
  return melhor;
}

/**
 * Entre os três leitores da mesma janela. A frase que DIZ "quantidade
 * mínima" é a mais segura — mas não pode esconder a tabela inteira quando
 * ela é só UMA linha da tabela repetida em prosa (no corpus, a frase achava o
 * CBUQ e a tabela tinha mais três parcelas). Regra: a frase vale quando cobre
 * ao menos metade das quantidades da tabela — tabela que tem o DOBRO de
 * linhas da frase é a que também traz os totais ("a ser contratada").
 */
function escolher(frase: RequiredService[], lista: RequiredService[], tabela: RequiredService[], tabelaDeVerdade: boolean): RequiredService[] {
  const valida = (l: RequiredService[]) => l.length > 0 && l.length <= MAX_PARCELAS;
  const tabelaValida = valida(tabela) ? tabela : [];
  if (valida(frase)) {
    // Sem cabeçalho de tabela de verdade, os "números de tabela" são da
    // própria prosa: a frase vence sempre.
    if (!tabelaDeVerdade || tabelaValida.length < 2) return frase;
    const cobertas = tabelaValida.filter((t) => frase.some((f) => f.quantity === t.quantity)).length;
    return cobertas / tabelaValida.length >= 0.5 ? frase : tabelaValida;
  }
  if (valida(lista)) return lista;
  return tabelaValida;
}

const palavras = (s: string) => new Set(s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z]{4,}/g) ?? []);

/**
 * A mesma parcela lida em dois documentos da licitação (edital e termo de
 * referência repetem a tabela) chega com descrições diferentes — uma limpa,
 * outra com cabeçalho colado — e a junção por descrição deixava as duas. No
 * corpus de 23/10/2026: 23 duplicatas assim. Mesma quantidade, mesma unidade
 * e descrição parecida (ao menos 40% das palavras em comum) é a mesma
 * parcela: fica a descrição mais curta, que é a sem sujeira. Itens diferentes
 * com o mesmo número (dois trechos de 7.200 m de serviços distintos) têm
 * descrições sem palavras em comum e continuam separados.
 */
export function semDuplicatasEntreDocumentos(lista: readonly RequiredService[]): RequiredService[] {
  const resultado: RequiredService[] = [];
  for (const parcela of lista) {
    const igual = resultado.findIndex((outra) => {
      if (outra.quantity !== parcela.quantity || outra.unit !== parcela.unit) return false;
      const a = palavras(outra.description), b = palavras(parcela.description);
      const comuns = [...a].filter((p) => b.has(p)).length;
      return comuns / Math.max(1, Math.min(a.size, b.size)) >= 0.4;
    });
    if (igual < 0) resultado.push(parcela);
    else if (parcela.description.length < resultado[igual]!.description.length) resultado[igual] = parcela;
  }
  return resultado;
}
