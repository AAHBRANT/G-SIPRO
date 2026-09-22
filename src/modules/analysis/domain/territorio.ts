/**
 * Recorte territorial da Análise: onde estão as licitações que o buscador
 * acompanha, por unidade da federação e por esfera do órgão.
 *
 * ⚠️ O QUE O MAPA MOSTRA É A SEDE DO ÓRGÃO, NÃO O LOCAL DA OBRA. O portal
 * informa o município e a UF da unidade administrativa que publicou o edital;
 * não informa onde a obra será executada. Na maioria das licitações municipais
 * dá no mesmo, mas uma licitação estadual ou federal aparece na capital ainda
 * que a obra seja no interior. A tela precisa dizer isso — apresentar como
 * "onde estão as obras" seria afirmar o que o dado não sustenta.
 *
 * ⚠️ ESFERA E LOCALIZAÇÃO SÃO INDEPENDENTES. Esfera é de quem contrata
 * (federal, estadual, municipal, distrital); UF é onde o órgão está. Um órgão
 * federal publica de Brasília uma obra em Campinas. Não inferir uma da outra.
 *
 * ⚠️ VALOR AUSENTE NÃO É ZERO, e aqui ele é tratado diferente do funil. No
 * funil, uma parcela desconhecida torna o total desconhecido — o certo quando
 * se compara duas etapas. No mapa isso apagaria o país inteiro: basta uma UF
 * com orçamento sigiloso para o total nacional virar "—". Então o território
 * soma o que é conhecido e carrega `semValor` junto, para a tela poder dizer
 * quantas licitações ficaram de fora da soma.
 */
import { etapasDoFunil, type EtapaDoFunil } from "@/modules/analysis/domain/funil-comercial";
import { REGIOES, UNIDADES_FEDERATIVAS, ufPorSigla, type Regiao } from "@/modules/analysis/domain/malha-uf";

/** Esferas como o PNCP as publica em `orgaoEntidade.esferaId`. */
export const ESFERAS = ["F", "E", "M", "D"] as const;
export type Esfera = (typeof ESFERAS)[number];

export const rotuloDaEsfera: Record<Esfera, string> = {
  F: "Federal",
  E: "Estadual",
  M: "Municipal",
  D: "Distrital",
};

/**
 * O campo tem um caractere e vem do portal sem garantia nenhuma. Qualquer
 * coisa fora das quatro esferas conhecidas fica de fora dos cards de esfera
 * em vez de ser empurrada para "Municipal" — classificação errada de órgão
 * distorce a leitura mais do que uma barra a menos.
 */
export function esferaConhecida(bruta: string | null | undefined): Esfera | null {
  if (!bruta) return null;
  const alvo = bruta.trim().toUpperCase();
  return (ESFERAS as readonly string[]).includes(alvo) ? (alvo as Esfera) : null;
}

export type Medida = "qtd" | "val";

/**
 * Uma linha da agregação do banco: um mês, uma UF e uma esfera.
 *
 * `uf` nulo é licitação sem UF informada no portal. Ela existe, conta nos
 * totais nacionais e não aparece em nenhum estado do mapa — por isso a tela
 * mostra o número à parte, em vez de somá-lo em algum lugar plausível.
 */
export type CelulaTerritorial = Readonly<{
  /** Primeiro dia do mês da coorte, em UTC (AAAA-MM-DD). */
  mes: string;
  uf: string | null;
  esfera: string;
  quantidade: Readonly<Record<EtapaDoFunil, number>>;
  valor: Readonly<Record<EtapaDoFunil, number | null>>;
  /** Licitações da célula sem valor estimado informado. */
  semValor: number;
}>;

export type TotalTerritorial = Readonly<{
  quantidade: number;
  valor: number | null;
  semValor: number;
}>;

const VAZIO: TotalTerritorial = { quantidade: 0, valor: null, semValor: 0 };

/**
 * UF que não aparece na agregação simplesmente não teve licitação nenhuma:
 * zero CONHECIDO, tanto em quantidade quanto em reais — não há o que somar.
 *
 * ⚠️ Não confundir com `VAZIO`, cujo valor é nulo. A diferença aparece no
 * mapa: sem ocorrência pinta cinza claro, valor desconhecido pinta hachurado.
 * Usar um pelo outro faz o Acre, que não teve licitação, parecer um estado
 * cujo dado a gente perdeu.
 */
export const SEM_OCORRENCIA: TotalTerritorial = { quantidade: 0, valor: 0, semValor: 0 };

const finito = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Soma que ignora o desconhecido e conta quantos ficaram de fora. Ver o topo. */
function somar(a: TotalTerritorial, b: TotalTerritorial): TotalTerritorial {
  const valor = finito(a.valor) || finito(b.valor) ? (finito(a.valor) ? a.valor : 0) + (finito(b.valor) ? b.valor : 0) : null;
  return { quantidade: a.quantidade + b.quantidade, valor, semValor: a.semValor + b.semValor };
}

function daCelula(celula: CelulaTerritorial, etapa: EtapaDoFunil): TotalTerritorial {
  const quantidade = celula.quantidade[etapa] ?? 0;
  return {
    quantidade,
    valor: celula.valor[etapa] ?? null,
    // `semValor` é medido sobre a base da célula; só faz sentido informá-lo
    // quando a etapa tem alguma licitação, senão viraria um aviso sobre nada.
    semValor: quantidade > 0 ? celula.semValor : 0,
  };
}

/** A medida que a tela está exibindo. Nulo é "não sei", nunca zero. */
export function medidaDe(total: TotalTerritorial, medida: Medida): number | null {
  return medida === "qtd" ? total.quantidade : total.valor;
}

export type Filtro = Readonly<{
  /** Meses a considerar. Vazio ou ausente = todos os meses recebidos. */
  meses?: ReadonlySet<string> | null;
  esfera?: Esfera | null;
  regiao?: Regiao | null;
}>;

/**
 * ⚠️ O filtro de REGIÃO se aplica só a células com UF conhecida. Licitação
 * sem UF não pertence a região nenhuma: incluí-la em todas inflaria cada
 * região, e incluí-la em nenhuma quando não há região escolhida esconderia
 * licitação que existe. Por isso ela sobrevive ao filtro vazio e cai no
 * filtro por região.
 */
export function filtrar(celulas: readonly CelulaTerritorial[], filtro: Filtro = {}): readonly CelulaTerritorial[] {
  const { meses, esfera, regiao } = filtro;
  return celulas.filter((celula) => {
    if (meses && meses.size > 0 && !meses.has(celula.mes)) return false;
    if (esfera && esferaConhecida(celula.esfera) !== esfera) return false;
    if (regiao) {
      const uf = ufPorSigla(celula.uf);
      if (!uf || uf.regiao !== regiao) return false;
    }
    return true;
  });
}

/** Total de uma etapa no conjunto inteiro, incluindo o que não tem UF. */
export function total(celulas: readonly CelulaTerritorial[], etapa: EtapaDoFunil): TotalTerritorial {
  return celulas.reduce((acumulado, celula) => somar(acumulado, daCelula(celula, etapa)), VAZIO);
}

/** Licitações sem UF informada — ficam fora do mapa e precisam ser ditas. */
export function semLocalizacao(celulas: readonly CelulaTerritorial[], etapa: EtapaDoFunil): TotalTerritorial {
  return total(celulas.filter((celula) => !ufPorSigla(celula.uf)), etapa);
}

/** Total por sigla de UF. Só entram UFs que existem na malha. */
export function porUf(celulas: readonly CelulaTerritorial[], etapa: EtapaDoFunil): ReadonlyMap<string, TotalTerritorial> {
  const mapa = new Map<string, TotalTerritorial>();
  for (const celula of celulas) {
    const uf = ufPorSigla(celula.uf);
    if (!uf) continue;
    mapa.set(uf.sigla, somar(mapa.get(uf.sigla) ?? VAZIO, daCelula(celula, etapa)));
  }
  return mapa;
}

/** Total por região, a partir dos totais de UF. */
export function porRegiao(celulas: readonly CelulaTerritorial[], etapa: EtapaDoFunil): ReadonlyMap<Regiao, TotalTerritorial> {
  const porSigla = porUf(celulas, etapa);
  const mapa = new Map<Regiao, TotalTerritorial>();
  for (const uf of UNIDADES_FEDERATIVAS) {
    const parcela = porSigla.get(uf.sigla);
    if (!parcela) continue;
    mapa.set(uf.regiao, somar(mapa.get(uf.regiao) ?? VAZIO, parcela));
  }
  return mapa;
}

/**
 * No agrupamento por REGIÃO, toda UF recebe o total da sua região — é o que
 * pinta o mapa em blocos regionais em vez de estaduais.
 */
export function pintarPorRegiao(porRegiaoMapa: ReadonlyMap<Regiao, TotalTerritorial>): ReadonlyMap<string, TotalTerritorial> {
  const mapa = new Map<string, TotalTerritorial>();
  for (const uf of UNIDADES_FEDERATIVAS) {
    const parcela = porRegiaoMapa.get(uf.regiao);
    if (parcela) mapa.set(uf.sigla, parcela);
  }
  return mapa;
}

/** Quantos níveis a escala do mapa tem, do mais claro ao vinho cheio. */
export const NIVEIS_DA_ESCALA = 5;

/**
 * Nível de cor de um valor dentro da escala.
 *
 * - `null` — não dá para saber (medida desconhecida ou escala sem máximo):
 *   a tela pinta como INDISPONÍVEL, que é visualmente diferente de vazio.
 * - `0` — conhecido e sem ocorrência.
 * - `1..NIVEIS_DA_ESCALA` — do mais claro ao mais escuro.
 *
 * ⚠️ O máximo é sempre o MÁXIMO NACIONAL da mesma etapa, período e esfera.
 * Recalibrar a escala ao selecionar um estado faria a mesma cor significar
 * coisas diferentes em dois instantes da mesma sessão.
 */
export function nivelDeCor(valor: number | null, maximo: number | null): number | null {
  if (!finito(valor) || !finito(maximo) || maximo <= 0) return null;
  if (valor <= 0) return 0;
  const nivel = Math.ceil((NIVEIS_DA_ESCALA * valor) / maximo);
  return Math.min(NIVEIS_DA_ESCALA, Math.max(1, nivel));
}

/** Maior medida conhecida do conjunto. Nulo quando nenhuma é conhecida. */
export function maximo(totais: Iterable<TotalTerritorial>, medida: Medida): number | null {
  let maior: number | null = null;
  for (const item of totais) {
    const valor = medidaDe(item, medida);
    if (finito(valor) && (maior === null || valor > maior)) maior = valor;
  }
  return maior;
}

export type LinhaDeRanking = Readonly<{
  chave: string;
  rotulo: string;
  total: TotalTerritorial;
  medida: number | null;
}>;

/**
 * Ordena do maior para o menor pela medida ativa. O desconhecido vai para o
 * fim — não para o começo, que é onde o `undefined` do JavaScript o colocaria
 * num `sort` ingênuo, fazendo "sem dado" parecer o líder.
 */
export function ordenarRanking(linhas: readonly LinhaDeRanking[]): readonly LinhaDeRanking[] {
  return [...linhas].sort((a, b) => {
    const x = finito(a.medida) ? a.medida : -1;
    const y = finito(b.medida) ? b.medida : -1;
    if (x !== y) return y - x;
    return a.rotulo.localeCompare(b.rotulo, "pt-BR");
  });
}

/**
 * Participação de uma parte no total nacional, em percentual. Nulo — nunca
 * NaN, nunca Infinity — quando falta qualquer um dos dois.
 */
export function participacao(parte: number | null, nacional: number | null): number | null {
  if (!finito(parte) || !finito(nacional) || nacional <= 0) return null;
  return (100 * parte) / nacional;
}

export type FatiaDeEsfera = Readonly<{
  esfera: Esfera;
  rotulo: string;
  total: TotalTerritorial;
  medida: number | null;
  /** Percentual dentro do recorte territorial ativo. */
  percentual: number | null;
}>;

/**
 * Distribuição por esfera DENTRO do recorte territorial.
 *
 * ⚠️ Recebe as células ANTES do filtro de esfera, de propósito: os cards
 * servem para escolher uma esfera, e se já viessem filtrados mostrariam 100%
 * na escolhida e zero nas outras assim que uma fosse selecionada — perdendo
 * exatamente a comparação que faz o controle ter utilidade.
 */
export function distribuicaoPorEsfera(
  celulas: readonly CelulaTerritorial[],
  etapa: EtapaDoFunil,
  medida: Medida,
): readonly FatiaDeEsfera[] {
  const totais = new Map<Esfera, TotalTerritorial>();
  for (const celula of celulas) {
    const esfera = esferaConhecida(celula.esfera);
    if (!esfera) continue;
    totais.set(esfera, somar(totais.get(esfera) ?? VAZIO, daCelula(celula, etapa)));
  }
  const soma = [...totais.values()].reduce(somar, VAZIO);
  const referencia = medidaDe(soma, medida);
  return ESFERAS.map((esfera) => {
    const item = totais.get(esfera) ?? VAZIO;
    const valor = medidaDe(item, medida);
    return {
      esfera,
      rotulo: rotuloDaEsfera[esfera],
      total: item,
      medida: valor,
      percentual: participacao(valor, referencia),
    };
  });
}

/** Linha da tabela de atuação: uma UF (ou região) com todas as etapas. */
export type LinhaDeAtuacao = Readonly<{
  chave: string;
  rotulo: string;
  etapas: Readonly<Record<EtapaDoFunil, TotalTerritorial>>;
}>;

export function tabelaDeAtuacao(
  celulas: readonly CelulaTerritorial[],
  agrupamento: "uf" | "regiao",
): readonly LinhaDeAtuacao[] {
  const linhas = new Map<string, { rotulo: string; etapas: Record<EtapaDoFunil, TotalTerritorial> }>();
  for (const celula of celulas) {
    const uf = ufPorSigla(celula.uf);
    if (!uf) continue;
    const chave = agrupamento === "uf" ? uf.sigla : uf.regiao;
    const rotulo = agrupamento === "uf" ? `${uf.sigla} · ${uf.nome}` : uf.regiao;
    const linha = linhas.get(chave) ?? {
      rotulo,
      etapas: Object.fromEntries(etapasDoFunil.map((e) => [e, VAZIO])) as Record<EtapaDoFunil, TotalTerritorial>,
    };
    for (const etapa of etapasDoFunil) linha.etapas[etapa] = somar(linha.etapas[etapa], daCelula(celula, etapa));
    linhas.set(chave, linha);
  }
  return [...linhas.entries()].map(([chave, linha]) => ({ chave, rotulo: linha.rotulo, etapas: linha.etapas }));
}

/** Regiões que têm alguma licitação no conjunto — para não oferecer filtro vazio. */
export function regioesComDados(celulas: readonly CelulaTerritorial[]): readonly Regiao[] {
  const presentes = new Set<Regiao>();
  for (const celula of celulas) {
    const uf = ufPorSigla(celula.uf);
    if (uf) presentes.add(uf.regiao);
  }
  return REGIOES.filter((regiao) => presentes.has(regiao));
}
