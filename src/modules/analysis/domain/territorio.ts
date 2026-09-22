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
  /** Município da unidade do órgão, como o portal o escreve. */
  cidade: string | null;
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
  /** Sigla da unidade da federação. */
  uf?: string | null;
  /** Chave `nome normalizado|UF` de um município. */
  municipio?: string | null;
}>;

/**
 * ⚠️ O filtro de REGIÃO se aplica só a células com UF conhecida. Licitação
 * sem UF não pertence a região nenhuma: incluí-la em todas inflaria cada
 * região, e incluí-la em nenhuma quando não há região escolhida esconderia
 * licitação que existe. Por isso ela sobrevive ao filtro vazio e cai no
 * filtro por região.
 */
export function filtrar(celulas: readonly CelulaTerritorial[], filtro: Filtro = {}): readonly CelulaTerritorial[] {
  const { meses, esfera, regiao, uf: siglaUf, municipio } = filtro;
  return celulas.filter((celula) => {
    if (meses && meses.size > 0 && !meses.has(celula.mes)) return false;
    if (esfera && esferaConhecida(celula.esfera) !== esfera) return false;
    if (regiao) {
      const uf = ufPorSigla(celula.uf);
      if (!uf || uf.regiao !== regiao) return false;
    }
    if (siglaUf && ufPorSigla(celula.uf)?.sigla !== siglaUf) return false;
    if (municipio && chaveDaCelula(celula) !== municipio) return false;
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

/* ============================================================
   Municípios, projeção e o resto da seção territorial
   ============================================================ */

/**
 * Como a seção territorial nomeia as etapas.
 *
 * ⚠️ "Universo" aqui é TUDO QUE O BUSCADOR ACHOU — decisão do dono em
 * 22/09/2026 —, não o mercado de licitações do país. Se o filtro de perfil do
 * buscador estiver apertado demais, o universo encolhe junto e ninguém
 * percebe pelo número. A tela precisa dizer isso por extenso; o rótulo
 * sozinho convida ao erro contrário.
 */
export const rotuloTerritorial: Record<EtapaDoFunil, string> = {
  aderentes: "Universo · tudo que o buscador achou",
  aprovadas: "Aprovadas para estudo",
  orcamento: "Estudo concluído",
  propostas: "Participamos · proposta enviada",
};

/** Versão curta, para caber em cabeçalho de tabela e card. */
export const rotuloCurtoTerritorial: Record<EtapaDoFunil, string> = {
  aderentes: "Universo",
  aprovadas: "Aprovadas para estudo",
  orcamento: "Estudo concluído",
  propostas: "Participamos",
};

/** Município com licitação no período, já resolvido pelo servidor. */
export type MunicipioNoMapa = Readonly<{
  /** `nome normalizado|UF` — a mesma chave que o filtro usa. */
  chave: string;
  nome: string;
  uf: string;
  ibge: number;
  latitude: number;
  longitude: number;
}>;

/** Uma licitação na lista do recorte. */
export type LicitacaoDoRecorte = Readonly<{
  id: string;
  /** numeroControlePNCP — o identificador estável da contratação. */
  identificador: string;
  objeto: string;
  uf: string | null;
  cidade: string | null;
  esfera: string;
  autoridade: string;
  /** ISO. É quando o buscador captou, não quando o portal publicou. */
  captadaEm: string;
  fechaEm: string | null;
  valor: number | null;
  aprovada: boolean;
  estudoConcluido: boolean;
  propostaEnviada: boolean;
}>;

/**
 * Chave de município de uma célula. Mesma normalização de
 * `municipios-brasil.ts` — repetida aqui porque aquele módulo não pode
 * atravessar para o navegador, e esta função precisa rodar nos dois lados.
 */
export function chaveDaCelula(celula: CelulaTerritorial): string | null {
  if (!celula.cidade || !celula.uf) return null;
  const nome = celula.cidade
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return nome ? `${nome}|${celula.uf.trim().toUpperCase()}` : null;
}

/**
 * Projeção equiretangular calibrada para a malha do IBGE que este projeto
 * embute: `x = (longitude + 74) × 16,4` e `y = (6 − latitude) × 16,4`, no
 * sistema de `VIEWBOX_DO_BRASIL`.
 *
 * ⚠️ Os números não são arbitrários e não devem ser "arredondados": eles vêm
 * da mesma projeção com que a malha foi gerada. O teste prova a calibração do
 * jeito que importa — as 27 capitais caem dentro do contorno da própria UF.
 * Mudar a malha sem refazer a projeção põe todo ponto no lugar errado, e o
 * erro é pequeno o bastante para passar despercebido num relance.
 */
export const PROJECAO = { origemLongitude: -74, origemLatitude: 6, escala: 16.4 } as const;

export function projetar(latitude: number, longitude: number): Readonly<{ x: number; y: number }> {
  return {
    x: (longitude - PROJECAO.origemLongitude) * PROJECAO.escala,
    y: (PROJECAO.origemLatitude - latitude) * PROJECAO.escala,
  };
}

/** Total por município (pela chave), só de células com município conhecido. */
export function porMunicipio(
  celulas: readonly CelulaTerritorial[],
  etapa: EtapaDoFunil,
): ReadonlyMap<string, TotalTerritorial> {
  const mapa = new Map<string, TotalTerritorial>();
  for (const celula of celulas) {
    const chave = chaveDaCelula(celula);
    if (!chave) continue;
    mapa.set(chave, somar(mapa.get(chave) ?? VAZIO, daCelula(celula, etapa)));
  }
  return mapa;
}

/** Nome legível de cada município presente, pela chave. */
export function nomesDeMunicipios(celulas: readonly CelulaTerritorial[]): ReadonlyMap<string, { nome: string; uf: string }> {
  const mapa = new Map<string, { nome: string; uf: string }>();
  for (const celula of celulas) {
    const chave = chaveDaCelula(celula);
    if (!chave || mapa.has(chave) || !celula.cidade || !celula.uf) continue;
    mapa.set(chave, { nome: celula.cidade.trim(), uf: celula.uf.trim().toUpperCase() });
  }
  return mapa;
}

/** Licitações cujo município o portal não informou — ficam sem ponto. */
export function semMunicipio(celulas: readonly CelulaTerritorial[], etapa: EtapaDoFunil): TotalTerritorial {
  return total(celulas.filter((celula) => chaveDaCelula(celula) === null), etapa);
}

export type ResumoRegional = Readonly<{
  regiao: Regiao;
  total: TotalTerritorial;
  medida: number | null;
  /** Participação no total nacional da mesma etapa, período e esfera. */
  participacao: number | null;
}>;

/**
 * As cinco regiões, SEMPRE todas — inclusive as sem licitação nenhuma.
 * Esconder a região vazia tiraria justamente a informação que interessa a
 * quem procura onde a empresa não está.
 */
export function resumosRegionais(
  celulas: readonly CelulaTerritorial[],
  etapa: EtapaDoFunil,
  medida: Medida,
): readonly ResumoRegional[] {
  const mapa = porRegiao(celulas, etapa);
  const nacional = medidaDe(total(celulas, etapa), medida);
  return REGIOES.map((regiao) => {
    const item = mapa.get(regiao) ?? SEM_OCORRENCIA;
    const valor = medidaDe(item, medida);
    return { regiao, total: item, medida: valor, participacao: participacao(valor, nacional) };
  });
}

/**
 * A etapa mais avançada que a licitação alcançou.
 *
 * ⚠️ É a última etapa ALCANÇADA, não a única a que ela pertence: quem enviou
 * proposta também conta como aprovada para estudo em todas as somas. Confundir
 * as duas coisas faz a soma das "últimas etapas" parecer o funil, e não é.
 */
export function ultimaEtapa(registro: LicitacaoDoRecorte): EtapaDoFunil {
  if (registro.propostaEnviada) return "propostas";
  if (registro.estudoConcluido) return "orcamento";
  if (registro.aprovada) return "aprovadas";
  return "aderentes";
}

/** Aplica os filtros territoriais à lista de licitações. */
export function filtrarRegistros(
  registros: readonly LicitacaoDoRecorte[],
  filtro: Readonly<{ esfera?: Esfera | null; regiao?: Regiao | null; uf?: string | null; municipio?: string | null }>,
): readonly LicitacaoDoRecorte[] {
  return registros.filter((registro) => {
    if (filtro.esfera && esferaConhecida(registro.esfera) !== filtro.esfera) return false;
    const uf = ufPorSigla(registro.uf);
    if (filtro.regiao && (!uf || uf.regiao !== filtro.regiao)) return false;
    if (filtro.uf && uf?.sigla !== filtro.uf) return false;
    if (filtro.municipio) {
      const chave = chaveDaCelula({
        mes: "", uf: registro.uf, esfera: registro.esfera, cidade: registro.cidade,
        quantidade: { aderentes: 0, aprovadas: 0, orcamento: 0, propostas: 0 },
        valor: { aderentes: null, aprovadas: null, orcamento: null, propostas: null },
        semValor: 0,
      });
      if (chave !== filtro.municipio) return false;
    }
    return true;
  });
}

/* ============================================================
   Zoom do mapa
   ============================================================ */

export type Caixa = Readonly<{ x: number; y: number; largura: number; altura: number }>;

/** O Brasil inteiro, no sistema de `VIEWBOX_DO_BRASIL`. */
export const CAIXA_DO_BRASIL: Caixa = { x: 0, y: 0, largura: 730, altura: 680 };

/** Folga em volta do estado ampliado, como no protótipo aprovado. */
const FOLGA_DA_UF = 0.18;

export const ZOOM_MINIMO = 1;
export const ZOOM_MAXIMO = 8;

/**
 * Mantém o zoom dentro dos limites — e nunca deixa virar NaN.
 *
 * ⚠️ NaN e infinito caem em lados opostos de propósito: NaN é "não sei quanto
 * é" e volta ao mapa inteiro, que é o estado seguro; infinito é "muito maior
 * que o teto" e prende no teto. Mandar os dois para o mínimo faria um gesto
 * de ampliar exagerado devolver o país inteiro, que é o contrário do pedido.
 */
export function limitarZoom(zoom: number): number {
  if (Number.isNaN(zoom)) return ZOOM_MINIMO;
  return Math.min(ZOOM_MAXIMO, Math.max(ZOOM_MINIMO, zoom));
}

/**
 * A caixa de partida do mapa: o país, ou o estado escolhido com folga em
 * volta. É o que faz "entrar no estado" ao selecioná-lo.
 */
export function caixaBase(uf: Readonly<{ caixa: Caixa }> | undefined | null): Caixa {
  if (!uf) return CAIXA_DO_BRASIL;
  const folga = Math.max(uf.caixa.largura, uf.caixa.altura) * FOLGA_DA_UF;
  return {
    x: uf.caixa.x - folga,
    y: uf.caixa.y - folga,
    largura: uf.caixa.largura + 2 * folga,
    altura: uf.caixa.altura + 2 * folga,
  };
}

/**
 * Aplica zoom e deslocamento sobre a caixa base.
 *
 * ⚠️ O resultado é preso DENTRO da caixa base: sem isso, arrastar leva o mapa
 * para fora da tela e não há como voltar a não ser adivinhando o caminho de
 * volta. `centro` é onde o usuário arrastou, em unidades do próprio SVG.
 */
export function caixaComZoom(base: Caixa, zoom: number, centro: Readonly<{ x: number; y: number }> | null): Caixa {
  const fator = limitarZoom(zoom);
  const largura = base.largura / fator;
  const altura = base.altura / fator;
  const alvoX = centro && Number.isFinite(centro.x) ? centro.x : base.x + base.largura / 2;
  const alvoY = centro && Number.isFinite(centro.y) ? centro.y : base.y + base.altura / 2;
  return {
    x: Math.min(base.x + base.largura - largura, Math.max(base.x, alvoX - largura / 2)),
    y: Math.min(base.y + base.altura - altura, Math.max(base.y, alvoY - altura / 2)),
    largura,
    altura,
  };
}

/** A caixa no formato que o atributo `viewBox` espera. */
export function viewBoxDe(caixa: Caixa): string {
  return `${caixa.x.toFixed(1)} ${caixa.y.toFixed(1)} ${caixa.largura.toFixed(1)} ${caixa.altura.toFixed(1)}`;
}

/**
 * Quanto um elemento precisa encolher para MANTER O TAMANHO NA TELA depois do
 * zoom.
 *
 * ⚠️ Sem isto, ampliar um estado transforma cada ponto numa bolha e cada nome
 * numa faixa que cobre o mapa: o SVG escala tudo junto, inclusive o que
 * deveria ficar do mesmo tamanho.
 */
export function unidadeNaTela(caixa: Caixa): number {
  if (!Number.isFinite(caixa.largura) || caixa.largura <= 0) return 1;
  return caixa.largura / CAIXA_DO_BRASIL.largura;
}

export type PontoRotulavel = Readonly<{ chave: string; nome: string; x: number; y: number }>;

/**
 * Quais pontos podem exibir o nome sem um cobrir o outro.
 *
 * ⚠️ Cidades vizinhas — Belo Horizonte, Contagem e Betim, por exemplo — ficam
 * a poucos pixels uma da outra, e rotular todas produz uma pilha de texto
 * ilegível justamente onde há mais atividade. Percorre na ordem recebida (a
 * tela manda da maior para a menor) e só rotula quem não colide com um rótulo
 * já aceito, de modo que o maior sempre ganha o nome.
 *
 * `unidade` é a compensação de zoom: o rótulo tem tamanho fixo NA TELA, então
 * a caixa que ele ocupa no sistema do SVG encolhe quando o mapa amplia — é
 * por isso que ampliar faz caber mais nome, como se espera de um zoom.
 */
export function rotulosSemColisao(
  pontos: readonly PontoRotulavel[],
  unidade: number,
  obrigatorio: string | null = null,
): ReadonlySet<string> {
  const escala = Number.isFinite(unidade) && unidade > 0 ? unidade : 1;
  const alturaDoTexto = 13 * escala;
  const caixas: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const aceitos = new Set<string>();

  const cabe = (caixa: { x1: number; y1: number; x2: number; y2: number }) =>
    !caixas.some((outra) => caixa.x1 < outra.x2 && caixa.x2 > outra.x1 && caixa.y1 < outra.y2 && caixa.y2 > outra.y1);

  const caixaDe = (ponto: PontoRotulavel) => {
    // 6,4 px por caractere é a largura média da Arial no corpo usado aqui.
    const largura = (12 + ponto.nome.length * 6.4) * escala;
    return { x1: ponto.x, y1: ponto.y - alturaDoTexto / 2, x2: ponto.x + largura, y2: ponto.y + alturaDoTexto / 2 };
  };

  // O selecionado entra primeiro: ele é a resposta à ação do usuário e não
  // pode perder o nome para um vizinho maior.
  const escolhido = obrigatorio ? pontos.find((ponto) => ponto.chave === obrigatorio) : undefined;
  if (escolhido) {
    caixas.push(caixaDe(escolhido));
    aceitos.add(escolhido.chave);
  }

  for (const ponto of pontos) {
    if (aceitos.has(ponto.chave)) continue;
    const caixa = caixaDe(ponto);
    if (!cabe(caixa)) continue;
    caixas.push(caixa);
    aceitos.add(ponto.chave);
  }
  return aceitos;
}
