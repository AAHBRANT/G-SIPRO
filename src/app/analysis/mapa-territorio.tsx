"use client";

import { useMemo, useState } from "react";

import { etapasDoFunil, type EtapaDoFunil } from "@/modules/analysis/domain/funil-comercial";
import { REGIOES, UNIDADES_FEDERATIVAS, VIEWBOX_DO_BRASIL, ufPorSigla, type Regiao } from "@/modules/analysis/domain/malha-uf";
import {
  NIVEIS_DA_ESCALA,
  SEM_OCORRENCIA,
  distribuicaoPorEsfera,
  filtrar,
  filtrarRegistros,
  maximo,
  medidaDe,
  nivelDeCor,
  nomesDeMunicipios,
  ordenarRanking,
  participacao,
  pintarPorRegiao,
  porMunicipio,
  porRegiao,
  porUf,
  projetar,
  resumosRegionais,
  rotuloCurtoTerritorial,
  rotuloDaEsfera,
  rotuloTerritorial,
  semLocalizacao,
  tabelaDeAtuacao,
  total,
  ultimaEtapa,
  type CelulaTerritorial,
  type Esfera,
  type LicitacaoDoRecorte,
  type LinhaDeRanking,
  type Medida,
  type MunicipioNoMapa,
  type TotalTerritorial,
} from "@/modules/analysis/domain/territorio";

/**
 * Seção territorial da Análise, na estrutura do handoff aprovado.
 *
 * ⚠️ OS FILTROS DAQUI NÃO MEXEM NOS CARDS DO TOPO. Período e medida vêm de
 * cima e valem para a tela inteira; etapa, região, estado, município e esfera
 * valem só para esta seção. A tela diz isso em texto — sem o aviso, quem
 * escolhe "Sul" e vê o card nacional inalterado conclui que está quebrado.
 *
 * ⚠️ O mapa mostra a SEDE DO ÓRGÃO que publicou, não o local da obra, e o
 * ponto é a sede do município, não o endereço da licitação. Ver
 * `territorio.ts`.
 *
 * ⚠️ "Universo" é tudo que O BUSCADOR achou, não o mercado. Filtro de perfil
 * apertado encolhe o universo sem mudar percentual nenhum — por isso a tela
 * escreve o que o número é, em vez de deixar o rótulo sugerir o contrário.
 */

type Props = Readonly<{
  celulas: readonly CelulaTerritorial[];
  municipios: readonly MunicipioNoMapa[];
  registros: readonly LicitacaoDoRecorte[];
  registrosCortados: boolean;
  /** Meses do recorte de período ativo, vindos do controle global. */
  meses: ReadonlySet<string>;
  medida: Medida;
}>;

/** Quantos pontos o mapa desenha antes de virar mancha ilegível. */
const TETO_DE_PONTOS = 40;

/** Licitações por página na lista do recorte. */
const POR_PAGINA = 8;

const num = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR"));

const brl = (v: number | null) => {
  if (v === null) return "—";
  if (Math.abs(v) >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} bi`;
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (v === 0) return "R$ 0";
  return `R$ ${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
};

const pct = (v: number | null) =>
  v === null ? "—" : `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const data = (iso: string | null) =>
  iso === null ? "—" : new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

const exibir = (item: TotalTerritorial, medida: Medida) => (medida === "qtd" ? num(item.quantidade) : brl(item.valor));

const complemento = (item: TotalTerritorial, medida: Medida) =>
  medida === "qtd" ? brl(item.valor) : `${num(item.quantidade)} licitações`;

const ordinal = (indice: number) => String(indice + 1).padStart(2, "0");

export function MapaTerritorio({ celulas, municipios, registros, registrosCortados, meses, medida }: Props) {
  const [etapa, setEtapa] = useState<EtapaDoFunil>("aderentes");
  const [agrupamento, setAgrupamento] = useState<"uf" | "regiao">("uf");
  const [regiao, setRegiao] = useState<Regiao | null>(null);
  const [uf, setUf] = useState<string | null>(null);
  const [municipio, setMunicipio] = useState<string | null>(null);
  const [esfera, setEsfera] = useState<Esfera | null>(null);
  const [pagina, setPagina] = useState(0);

  const doPeriodo = useMemo(() => filtrar(celulas, { meses }), [celulas, meses]);

  /**
   * ⚠️ Os cards de esfera saem DAQUI, antes do filtro de esfera: se viessem
   * filtrados, a esfera escolhida mostraria 100% e as outras zero, perdendo
   * exatamente a comparação que faz o controle servir para alguma coisa.
   */
  const antesDaEsfera = useMemo(() => filtrar(doPeriodo, { regiao, municipio }), [doPeriodo, regiao, municipio]);
  const recorte = useMemo(() => filtrar(antesDaEsfera, { esfera }), [antesDaEsfera, esfera]);

  /**
   * ⚠️ A escala de cor é calibrada pelo NACIONAL da mesma etapa, período e
   * esfera — nunca pelo recorte. Recalibrar ao escolher uma região faria a
   * mesma cor significar coisas diferentes na mesma sessão.
   */
  const nacional = useMemo(() => filtrar(doPeriodo, { esfera }), [doPeriodo, esfera]);

  const pintura = useMemo(
    () => (agrupamento === "uf" ? porUf(nacional, etapa) : pintarPorRegiao(porRegiao(nacional, etapa))),
    [nacional, etapa, agrupamento],
  );

  const teto = useMemo(
    () => maximo(agrupamento === "uf" ? porUf(nacional, etapa).values() : porRegiao(nacional, etapa).values(), medida),
    [nacional, etapa, agrupamento, medida],
  );

  const totalNacional = useMemo(() => total(nacional, etapa), [nacional, etapa]);
  const doRecorte = useMemo(
    () => Object.fromEntries(etapasDoFunil.map((e) => [e, total(recorte, e)])) as Record<EtapaDoFunil, TotalTerritorial>,
    [recorte],
  );
  const foraDoMapa = useMemo(() => semLocalizacao(recorte, etapa), [recorte, etapa]);

  const nomesMunicipais = useMemo(() => nomesDeMunicipios(doPeriodo), [doPeriodo]);

  /** O recorte territorial, restrito ao estado selecionado quando há um. */
  const selecionado = useMemo(() => {
    const alvo = uf ? recorte.filter((c) => ufPorSigla(c.uf)?.sigla === uf) : recorte;
    return Object.fromEntries(etapasDoFunil.map((e) => [e, total(alvo, e)])) as Record<EtapaDoFunil, TotalTerritorial>;
  }, [recorte, uf]);

  const nomeDoEscopo = useMemo(() => {
    if (municipio) return nomesMunicipais.get(municipio)?.nome ?? municipio;
    if (uf) return `${uf} · ${ufPorSigla(uf)?.nome ?? uf}`;
    return regiao ?? "Brasil";
  }, [municipio, uf, regiao, nomesMunicipais]);

  /**
   * Sem UF: ranking de estados (as 27, sempre) ou das cinco regiões.
   * Com UF: ranking dos municípios daquela UF.
   *
   * ⚠️ As 27 aparecem inteiras de propósito. Esconder quem tem zero tira a
   * informação de quem procura onde a empresa NÃO está.
   */
  const ranking = useMemo((): readonly LinhaDeRanking[] => {
    if (uf) {
      const mapa = porMunicipio(recorte.filter((c) => ufPorSigla(c.uf)?.sigla === uf), etapa);
      return ordenarRanking(
        [...mapa.entries()].map(([chave, item]) => ({
          chave,
          rotulo: nomesMunicipais.get(chave)?.nome ?? chave,
          total: item,
          medida: medidaDe(item, medida),
        })),
      );
    }
    if (agrupamento === "regiao") {
      const mapa = porRegiao(recorte, etapa);
      return ordenarRanking(
        REGIOES.map((item) => {
          const dele = mapa.get(item) ?? SEM_OCORRENCIA;
          return { chave: item, rotulo: item, total: dele, medida: medidaDe(dele, medida) };
        }),
      );
    }
    const mapa = porUf(recorte, etapa);
    const elegiveis = regiao ? UNIDADES_FEDERATIVAS.filter((item) => item.regiao === regiao) : UNIDADES_FEDERATIVAS;
    return ordenarRanking(
      elegiveis.map((item) => {
        const dele = mapa.get(item.sigla) ?? SEM_OCORRENCIA;
        return { chave: item.sigla, rotulo: `${item.sigla} · ${item.nome}`, total: dele, medida: medidaDe(dele, medida) };
      }),
    );
  }, [recorte, etapa, agrupamento, regiao, uf, medida, nomesMunicipais]);

  /** Barras do ranking são relativas ao líder da lista, não ao país. */
  const lider = ranking.find((linha) => linha.medida !== null && linha.medida > 0) ?? null;

  const esferas = useMemo(() => distribuicaoPorEsfera(antesDaEsfera, etapa, medida), [antesDaEsfera, etapa, medida]);
  const regionais = useMemo(
    () => resumosRegionais(filtrar(doPeriodo, { esfera }), etapa, medida),
    [doPeriodo, esfera, etapa, medida],
  );

  const atuacao = useMemo(() => {
    const alvo = uf ? recorte.filter((c) => ufPorSigla(c.uf)?.sigla === uf) : recorte;
    const linhas = uf
      ? [...porMunicipio(alvo, "aderentes").keys()].map((chave) => ({
        chave,
        rotulo: nomesMunicipais.get(chave)?.nome ?? chave,
        etapas: Object.fromEntries(
          etapasDoFunil.map((item) => [item, porMunicipio(alvo, item).get(chave) ?? SEM_OCORRENCIA]),
        ) as Record<EtapaDoFunil, TotalTerritorial>,
      }))
      : tabelaDeAtuacao(alvo, agrupamento === "regiao" ? "regiao" : "uf");
    return [...linhas].sort((a, b) => {
      const x = medidaDe(a.etapas[etapa], medida) ?? -1;
      const y = medidaDe(b.etapas[etapa], medida) ?? -1;
      return y - x || a.rotulo.localeCompare(b.rotulo, "pt-BR");
    });
  }, [recorte, agrupamento, uf, etapa, medida, nomesMunicipais]);

  /**
   * Pontos do mapa. Só municípios com ocorrência na etapa, limitados aos
   * maiores — cem pontos sobrepostos não informam nada — e sempre incluindo
   * o selecionado, que precisa estar visível mesmo sendo pequeno.
   */
  const pontos = useMemo(() => {
    const porChave = porMunicipio(recorte, etapa);
    const candidatos = municipios
      .filter((item) => !regiao || ufPorSigla(item.uf)?.regiao === regiao)
      .filter((item) => !uf || item.uf === uf)
      .map((item) => ({ ...item, total: porChave.get(item.chave) ?? SEM_OCORRENCIA }))
      .filter((item) => item.total.quantidade > 0 || item.chave === municipio)
      .sort((a, b) => (medidaDe(b.total, medida) ?? 0) - (medidaDe(a.total, medida) ?? 0));
    const visiveis = candidatos.slice(0, TETO_DE_PONTOS);
    const escolhido = candidatos.find((item) => item.chave === municipio);
    if (escolhido && !visiveis.includes(escolhido)) visiveis.push(escolhido);
    return { visiveis, ocultos: Math.max(0, candidatos.length - visiveis.length) };
  }, [municipios, recorte, etapa, medida, regiao, uf, municipio]);

  const listaFiltrada = useMemo(
    () => filtrarRegistros(registros, { esfera, regiao, uf, municipio }),
    [registros, esfera, regiao, uf, municipio],
  );
  const paginas = Math.max(1, Math.ceil(listaFiltrada.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, paginas - 1);
  const daPagina = listaFiltrada.slice(paginaAtual * POR_PAGINA, (paginaAtual + 1) * POR_PAGINA);

  const ufsElegiveis = useMemo(
    () => UNIDADES_FEDERATIVAS.filter((item) => !regiao || item.regiao === regiao),
    [regiao],
  );
  const municipiosElegiveis = useMemo(() => {
    const presentes = porMunicipio(filtrar(doPeriodo, { esfera, regiao }), "aderentes");
    return [...presentes.keys()]
      .map((chave) => ({ chave, ...(nomesMunicipais.get(chave) ?? { nome: chave, uf: "" }) }))
      .filter((item) => !uf || item.uf === uf)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [doPeriodo, esfera, regiao, uf, nomesMunicipais]);

  /** Trocar de região invalida estado e município de outra região. */
  const trocarRegiao = (nova: Regiao | null) => {
    setRegiao(nova);
    setPagina(0);
    if (uf && nova && ufPorSigla(uf)?.regiao !== nova) {
      setUf(null);
      setMunicipio(null);
    }
  };

  const trocarUf = (nova: string | null) => {
    setUf(nova);
    setPagina(0);
    if (nova === null) setMunicipio(null);
    else if (municipio && nomesMunicipais.get(municipio)?.uf !== nova) setMunicipio(null);
  };

  const clicarNoMapa = (sigla: string) => {
    if (agrupamento === "regiao" && !uf) {
      const dele = ufPorSigla(sigla)?.regiao ?? null;
      trocarRegiao(regiao === dele ? null : dele);
      return;
    }
    trocarUf(uf === sigla ? null : sigla);
  };

  const escolherPonto = (ponto: MunicipioNoMapa, escolhido: boolean) => {
    setUf(ponto.uf);
    setMunicipio(escolhido ? null : ponto.chave);
    setPagina(0);
  };

  const limparMapa = () => {
    setEtapa("aderentes");
    setAgrupamento("uf");
    setRegiao(null);
    setUf(null);
    setMunicipio(null);
    setEsfera(null);
    setPagina(0);
  };

  const semDados = totalNacional.quantidade === 0;
  const aprovadasSemProposta = doRecorte.aprovadas.quantidade - doRecorte.propostas.quantidade;
  const escopoDaEsfera = esfera ? rotuloDaEsfera[esfera].toLowerCase() : "todas as esferas";

  return (
    <div className="an-bloco an-terr">
      <div className="an-terr-cabeca">
        <div>
          <h2 id="an-h-mapa">Território &amp; oportunidades</h2>
          <p className="an-ajuda">Cruze localização, esfera do órgão e avanço comercial em uma única análise.</p>
        </div>
        <nav aria-label="Nível territorial" className="an-migalhas">
          <button onClick={() => { setRegiao(null); trocarUf(null); }} type="button">Brasil</button>
          {regiao ? <><span aria-hidden="true">›</span><button onClick={() => trocarUf(null)} type="button">{regiao}</button></> : null}
          {uf ? <><span aria-hidden="true">›</span><button onClick={() => setMunicipio(null)} type="button">{uf}</button></> : null}
          {municipio ? <><span aria-hidden="true">›</span><b>{nomesMunicipais.get(municipio)?.nome}</b></> : null}
        </nav>
      </div>

      <div className="an-terr-ctrl">
        <div className="an-campo">
          <label htmlFor="an-m-etapa">Mostrar</label>
          <select id="an-m-etapa" onChange={(e) => setEtapa(e.target.value as EtapaDoFunil)} value={etapa}>
            {etapasDoFunil.map((item) => <option key={item} value={item}>{rotuloTerritorial[item]}</option>)}
          </select>
        </div>
        <div className="an-campo">
          <label htmlFor="an-m-agrupar">Agrupar</label>
          <select id="an-m-agrupar" onChange={(e) => setAgrupamento(e.target.value as "uf" | "regiao")} value={agrupamento}>
            <option value="uf">Estados</option>
            <option value="regiao">Regiões</option>
          </select>
        </div>
        <div className="an-campo">
          <label htmlFor="an-m-regiao">Região</label>
          <select id="an-m-regiao" onChange={(e) => trocarRegiao(e.target.value === "" ? null : (e.target.value as Regiao))} value={regiao ?? ""}>
            <option value="">Todo o Brasil</option>
            {REGIOES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="an-campo">
          <label htmlFor="an-m-uf">Estado</label>
          <select id="an-m-uf" onChange={(e) => trocarUf(e.target.value === "" ? null : e.target.value)} value={uf ?? ""}>
            <option value="">Todos os estados</option>
            {ufsElegiveis.map((item) => <option key={item.sigla} value={item.sigla}>{item.nome} ({item.sigla})</option>)}
          </select>
        </div>
        <div className="an-campo">
          <label htmlFor="an-m-municipio">Município / local</label>
          <select
            id="an-m-municipio"
            onChange={(e) => { setMunicipio(e.target.value === "" ? null : e.target.value); setPagina(0); }}
            value={municipio ?? ""}
          >
            <option value="">Todos os locais</option>
            {municipiosElegiveis.map((item) => (
              <option key={item.chave} value={item.chave}>{item.nome} · {item.uf}</option>
            ))}
          </select>
        </div>
        <div className="an-campo">
          <label htmlFor="an-m-esfera">Esfera</label>
          <select
            id="an-m-esfera"
            onChange={(e) => { setEsfera(e.target.value === "" ? null : (e.target.value as Esfera)); setPagina(0); }}
            value={esfera ?? ""}
          >
            <option value="">Todas as esferas</option>
            {(Object.keys(rotuloDaEsfera) as Esfera[]).map((item) => (
              <option key={item} value={item}>{rotuloDaEsfera[item]}</option>
            ))}
          </select>
        </div>
        <button className="an-limpar" onClick={limparMapa} type="button">Limpar mapa</button>
      </div>

      <p className="an-escopo">
        Recorte: <b>{nomeDoEscopo}</b> · {escopoDaEsfera}. Filtros territoriais afetam só esta seção —
        os cards do topo continuam nacionais. O mapa mostra a <b>sede do órgão que publicou</b>, não o
        local da obra. <b>Universo</b> é tudo que o buscador achou no período, não o mercado inteiro.
        {foraDoMapa.quantidade > 0
          ? <> {num(foraDoMapa.quantidade)} sem estado informado no portal ficam fora do mapa e dentro dos totais.</>
          : null}
      </p>

      {semDados
        ? <p className="an-sem">Nenhuma licitação neste recorte de período.</p>
        : (
          <>
            <div className="an-terr-resumos">
              <div className="an-terr-resumo destaque">
                <span className="an-rot">Neste recorte</span>
                <span className="an-n">{exibir(doRecorte[etapa], medida)}</span>
                <span className="an-obs">{rotuloCurtoTerritorial[etapa]} · {complemento(doRecorte[etapa], medida)}</span>
              </div>
              <div className="an-terr-resumo">
                <span className="an-rot">Aprovadas para estudo</span>
                <span className="an-n">{exibir(doRecorte.aprovadas, medida)}</span>
                <span className="an-obs">
                  {pct(participacao(medidaDe(doRecorte.aprovadas, medida), medidaDe(doRecorte.aderentes, medida)))} do universo
                </span>
              </div>
              <div className="an-terr-resumo">
                <span className="an-rot">Participamos</span>
                <span className="an-n">{exibir(doRecorte.propostas, medida)}</span>
                <span className="an-obs">
                  {pct(participacao(medidaDe(doRecorte.propostas, medida), medidaDe(doRecorte.aderentes, medida)))} do universo
                </span>
              </div>
            </div>

            <h3 className="an-terr-h3">De qual esfera vêm as oportunidades?</h3>
            <p className="an-ajuda">
              Clique para filtrar · repartição de {rotuloCurtoTerritorial[etapa].toLowerCase()} no território,
              antes do filtro de esfera.
            </p>
            <div className="an-esferas">
              {esferas.map((fatia, indice) => (
                <button
                  aria-pressed={esfera === fatia.esfera}
                  className={`an-esfera${esfera === fatia.esfera ? " sel" : ""}`}
                  key={fatia.esfera}
                  onClick={() => { setEsfera(esfera === fatia.esfera ? null : fatia.esfera); setPagina(0); }}
                  type="button"
                >
                  <span className="an-esfera-topo">
                    <i aria-hidden="true">{ordinal(indice)}</i>
                    <span className="an-rot">{fatia.rotulo}</span>
                    <b aria-hidden="true">↗</b>
                  </span>
                  <span className="an-n">{exibir(fatia.total, medida)}</span>
                  <span className="an-obs">{complemento(fatia.total, medida)} · {pct(fatia.percentual)} do território</span>
                  <span aria-hidden="true" className="an-barra">
                    <i style={fatia.percentual === null ? undefined : { width: `${Math.min(100, fatia.percentual).toFixed(1)}%` }}/>
                  </span>
                </button>
              ))}
            </div>
            <p className="an-ajuda">
              Esfera é a administração do órgão contratante; o local é a sede da unidade que publicou. São
              independentes: um órgão federal publica de Brasília uma obra no interior. O Distrito Federal é
              uma esfera própria, não municipal.
            </p>

            <p className="an-terr-destaque">
              {lider
                ? <>{lider.rotulo} lidera este recorte com {exibir(lider.total, medida)}. </>
                : <>Nenhum {uf ? "município" : "estado"} com ocorrência nesta etapa. </>}
              {aprovadasSemProposta > 0
                ? <>{num(aprovadasSemProposta)} licitações aprovadas para estudo ainda não têm proposta enviada.</>
                : null}
            </p>

            <div className="an-terr-grade">
              <figure className="an-mapa">
                <figcaption className="an-mapa-titulo">
                  {rotuloCurtoTerritorial[etapa]}
                  <span>{uf ? "Clique no estado de novo para voltar ao Brasil" : "Clique em um estado para ver seus municípios"}</span>
                </figcaption>
                <svg aria-label={`Mapa do Brasil — ${rotuloCurtoTerritorial[etapa]}`} role="img" viewBox={VIEWBOX_DO_BRASIL}>
                  <defs>
                    {/* Estado sem medida conhecida. Hachura, não uma cor: vazio e
                        desconhecido precisam ser distinguíveis de relance. */}
                    <pattern height="6" id="an-hachura" patternTransform="rotate(45)" patternUnits="userSpaceOnUse" width="6">
                      <rect fill="rgba(120,120,120,0.10)" height="6" width="6"/>
                      <line stroke="rgba(120,120,120,0.55)" strokeWidth="1.4" x1="0" x2="0" y1="0" y2="6"/>
                    </pattern>
                  </defs>
                  {UNIDADES_FEDERATIVAS.map((item) => {
                    // Ausente da agregação = não teve licitação: zero conhecido.
                    const dele = pintura.get(item.sigla) ?? SEM_OCORRENCIA;
                    const ativo = uf === item.sigla || (!uf && regiao === item.regiao);
                    const apagado = Boolean((regiao && item.regiao !== regiao) || (uf && item.sigla !== uf));
                    const texto = dele.quantidade === 0
                      ? "sem ocorrência"
                      : medidaDe(dele, medida) === null
                        ? "valor não informado"
                        : exibir(dele, medida);
                    return (
                      <path
                        aria-label={`${item.nome}: ${texto}`}
                        className={`an-uf n${nivelDeCor(medidaDe(dele, medida), teto) ?? "x"}${ativo ? " sel" : ""}${apagado ? " fora" : ""}`}
                        d={item.contorno}
                        key={item.sigla}
                        onClick={() => clicarNoMapa(item.sigla)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); clicarNoMapa(item.sigla); }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <title>{`${item.nome}: ${texto}`}</title>
                      </path>
                    );
                  })}
                  {UNIDADES_FEDERATIVAS.map((item) => (
                    <text className="an-uf-sigla" key={`t-${item.sigla}`} x={item.rotuloX} y={item.rotuloY}>{item.sigla}</text>
                  ))}
                  {pontos.visiveis.map((ponto) => {
                    const { x, y } = projetar(ponto.latitude, ponto.longitude);
                    const escolhido = ponto.chave === municipio;
                    return (
                      <g
                        aria-label={`${ponto.nome}, ${ponto.uf}: ${exibir(ponto.total, medida)}`}
                        className={`an-ponto${escolhido ? " sel" : ""}`}
                        key={ponto.chave}
                        onClick={() => escolherPonto(ponto, escolhido)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); escolherPonto(ponto, escolhido); }
                        }}
                        role="button"
                        tabIndex={0}
                        transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}
                      >
                        <title>{`${ponto.nome} · ${ponto.uf} — sede do município`}</title>
                        <circle className="an-ponto-alvo" r="11"/>
                        <circle className="an-ponto-bola" r={escolhido ? 6 : 4}/>
                        {escolhido ? <text className="an-ponto-nome" x="12" y="4">{ponto.nome}</text> : null}
                      </g>
                    );
                  })}
                </svg>
                <div className="an-mapa-escala">
                  <span>0</span>
                  {Array.from({ length: NIVEIS_DA_ESCALA }, (_, i) => <i className={`n${i + 1}`} key={i}/>)}
                  <span>{teto === null ? "—" : medida === "qtd" ? num(teto) : brl(teto)}</span>
                  <b>{medida === "qtd" ? "licitações" : "valor estimado"}</b>
                </div>
                <p className="an-fonte">
                  Quanto mais escuro, maior o volume — escala nacional da etapa, período e esfera ativos.
                  Cinza claro: sem ocorrência. Hachurado: sem valor informado.
                  {pontos.visiveis.length > 0
                    ? ` Pontos = sedes de ${num(pontos.visiveis.length)} município(s), não endereços das licitações.`
                    : ""}
                  {pontos.ocultos > 0 ? ` ${num(pontos.ocultos)} município(s) menores ficaram sem ponto.` : ""}
                  {" "}Contorno: malha territorial do IBGE. Coordenadas: Municípios Brasileiros (kelvins), licença MIT.
                </p>
              </figure>

              <div className="an-terr-lado">
                <div className="an-terr-sel">
                  <p className="an-rot">Território selecionado</p>
                  <p className="an-terr-escopo">{nomeDoEscopo}</p>
                  <p className="an-n">{exibir(selecionado[etapa], medida)}</p>
                  <p className="an-obs">
                    {rotuloCurtoTerritorial[etapa]} · {complemento(selecionado[etapa], medida)} ·{" "}
                    {pct(participacao(medidaDe(selecionado[etapa], medida), medidaDe(totalNacional, medida)))} do total
                    nacional desta etapa
                  </p>
                  <dl className="an-terr-etapas">
                    {etapasDoFunil.map((item) => (
                      <div key={item}>
                        <dt>{rotuloCurtoTerritorial[item]}</dt>
                        <dd>{num(selecionado[item].quantidade)}<small>{brl(selecionado[item].valor)}</small></dd>
                      </div>
                    ))}
                  </dl>
                  <a className="an-terr-link" href="#an-licitacoes">Ver licitações deste recorte ↓</a>
                </div>

                <div className="an-rank">
                  <p className="an-rot">
                    {uf ? "Ranking dos municípios" : agrupamento === "regiao" ? "Ranking das regiões" : "Ranking dos estados"}
                    <span> · {ranking.length}</span>
                  </p>
                  <ol>
                    {ranking.map((linha, indice) => {
                      const largura = participacao(linha.medida, lider?.medida ?? null);
                      const ativo = uf
                        ? municipio === linha.chave
                        : agrupamento === "regiao" ? regiao === linha.chave : uf === linha.chave;
                      return (
                        <li className={ativo ? "sel" : undefined} key={linha.chave}>
                          <button
                            onClick={() => {
                              if (uf) { setMunicipio(municipio === linha.chave ? null : linha.chave); setPagina(0); return; }
                              if (agrupamento === "regiao") { trocarRegiao(regiao === linha.chave ? null : (linha.chave as Regiao)); return; }
                              trocarUf(uf === linha.chave ? null : linha.chave);
                            }}
                            type="button"
                          >
                            <span className="an-rank-pos">{ordinal(indice)}</span>
                            <span className="an-rank-nome">{linha.rotulo}</span>
                            <span className="an-rank-val">{exibir(linha.total, medida)}</span>
                            <span aria-hidden="true" className="an-rank-barra">
                              <i style={largura === null ? undefined : { width: `${Math.min(100, largura).toFixed(1)}%` }}/>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                  {ranking.length === 0 ? <p className="an-sem">Nenhum município com licitação neste recorte.</p> : null}
                </div>
              </div>
            </div>

            <div className="an-regionais">
              {regionais.map((resumo) => (
                <button
                  aria-pressed={regiao === resumo.regiao}
                  className={`an-regional${regiao === resumo.regiao ? " sel" : ""}`}
                  key={resumo.regiao}
                  onClick={() => trocarRegiao(regiao === resumo.regiao ? null : resumo.regiao)}
                  type="button"
                >
                  <span className="an-rot">{resumo.regiao}</span>
                  <span className="an-n">{exibir(resumo.total, medida)}</span>
                  <span className="an-obs">{pct(resumo.participacao)} do Brasil · {rotuloCurtoTerritorial[etapa].toLowerCase()}</span>
                </button>
              ))}
            </div>

            <h3 className="an-terr-h3">Atuação por {uf ? "município" : agrupamento === "regiao" ? "região" : "estado"}</h3>
            <p className="an-ajuda">Quantidade e valor estimado nas etapas acumuladas do território selecionado.</p>
            <div className="an-rolagem">
              <table>
                <caption className="an-sr">Etapas acumuladas por unidade territorial, no período e recorte ativos</caption>
                <thead>
                  <tr>
                    <th scope="col">{uf ? "Município" : agrupamento === "regiao" ? "Região" : "Estado"}</th>
                    {!uf && agrupamento !== "regiao" ? <th scope="col">Região</th> : null}
                    {etapasDoFunil.map((item) => <th key={item} scope="col">{rotuloCurtoTerritorial[item]}</th>)}
                    <th scope="col">Participamos / universo</th>
                  </tr>
                </thead>
                <tbody>
                  {atuacao.map((linha) => (
                    <tr className={uf === linha.chave || municipio === linha.chave ? "sel" : undefined} key={linha.chave}>
                      <th scope="row">{linha.rotulo}</th>
                      {!uf && agrupamento !== "regiao"
                        ? <td className="an-td-texto">{ufPorSigla(linha.chave)?.regiao ?? "—"}</td>
                        : null}
                      {etapasDoFunil.map((item) => (
                        <td key={item}>
                          {exibir(linha.etapas[item], medida)}
                          <small>{complemento(linha.etapas[item], medida)}</small>
                        </td>
                      ))}
                      <td>{pct(participacao(medidaDe(linha.etapas.propostas, medida), medidaDe(linha.etapas.aderentes, medida)))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {doRecorte[etapa].semValor > 0
              ? (
                <p className="an-ajuda">
                  {num(doRecorte[etapa].semValor)} licitação(ões) do recorte não informaram valor estimado (orçamento
                  sigiloso): contam na quantidade e ficam fora das somas em reais.
                </p>
              )
              : null}

            <h3 className="an-terr-h3" id="an-licitacoes">Licitações deste recorte</h3>
            <p className="an-ajuda">
              Ordenadas por valor estimado. A etapa mostrada é a mais avançada que a licitação alcançou — quem
              enviou proposta também conta como aprovada nas somas acima.
              {registrosCortados ? " A lista traz as maiores do período; o recorte tem mais do que cabe aqui." : ""}
            </p>
            <div className="an-rolagem">
              <table>
                <caption className="an-sr">Licitações do recorte territorial, ordenadas por valor estimado</caption>
                <thead>
                  <tr>
                    <th scope="col">Identificador</th>
                    <th scope="col">Objeto</th>
                    <th scope="col">Local</th>
                    <th scope="col">Esfera</th>
                    <th scope="col">Captada em</th>
                    <th scope="col">Valor estimado</th>
                    <th scope="col">Última etapa</th>
                  </tr>
                </thead>
                <tbody>
                  {daPagina.map((registro) => (
                    <tr key={registro.id}>
                      <th scope="row">{registro.identificador}</th>
                      <td className="an-td-texto">{registro.objeto.slice(0, 90)}{registro.objeto.length > 90 ? "…" : ""}</td>
                      <td className="an-td-texto">{registro.cidade ?? "—"}{registro.uf ? ` · ${registro.uf}` : ""}</td>
                      <td className="an-td-texto">{rotuloDaEsfera[registro.esfera as Esfera] ?? "—"}</td>
                      <td>{data(registro.captadaEm)}</td>
                      <td>{brl(registro.valor)}</td>
                      <td className="an-td-texto">{rotuloCurtoTerritorial[ultimaEtapa(registro)]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {listaFiltrada.length === 0
              ? <p className="an-sem">Nenhuma licitação neste recorte territorial.</p>
              : (
                <div className="an-paginas">
                  <button disabled={paginaAtual === 0} onClick={() => setPagina(paginaAtual - 1)} type="button">Anterior</button>
                  <span>
                    {paginaAtual * POR_PAGINA + 1}–{Math.min(listaFiltrada.length, (paginaAtual + 1) * POR_PAGINA)} de{" "}
                    {num(listaFiltrada.length)}
                  </span>
                  <button disabled={paginaAtual >= paginas - 1} onClick={() => setPagina(paginaAtual + 1)} type="button">Próxima</button>
                </div>
              )}
          </>
        )}
    </div>
  );
}
