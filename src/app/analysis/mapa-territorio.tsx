"use client";

import { useMemo, useState } from "react";

import { etapasDoFunil, rotuloDaEtapa, type EtapaDoFunil } from "@/modules/analysis/domain/funil-comercial";
import { REGIOES, UNIDADES_FEDERATIVAS, VIEWBOX_DO_BRASIL, ufPorSigla, type Regiao } from "@/modules/analysis/domain/malha-uf";
import {
  NIVEIS_DA_ESCALA,
  distribuicaoPorEsfera,
  filtrar,
  maximo,
  medidaDe,
  nivelDeCor,
  ordenarRanking,
  participacao,
  pintarPorRegiao,
  porRegiao,
  porUf,
  regioesComDados,
  SEM_OCORRENCIA,
  rotuloDaEsfera,
  semLocalizacao,
  tabelaDeAtuacao,
  total,
  type CelulaTerritorial,
  type Esfera,
  type LinhaDeRanking,
  type Medida,
  type TotalTerritorial,
} from "@/modules/analysis/domain/territorio";

/**
 * Mapa do Brasil da tela de Análise: onde estão as licitações que o buscador
 * acompanha, por unidade da federação e esfera do órgão.
 *
 * ⚠️ OS FILTROS DAQUI NÃO MEXEM NOS CARDS DO TOPO. Período e medida vêm de
 * cima e valem para a tela inteira; etapa, região, estado e esfera valem só
 * para esta seção. A tela diz isso em texto — sem o aviso, um usuário que
 * escolhe "Sul" e vê o card nacional inalterado conclui que a tela está
 * quebrada.
 *
 * ⚠️ O mapa mostra a SEDE DO ÓRGÃO, não o local da obra. Ver `territorio.ts`.
 */

type Props = Readonly<{
  celulas: readonly CelulaTerritorial[];
  /** Meses do recorte de período ativo, vindos do controle global. */
  meses: ReadonlySet<string>;
  medida: Medida;
}>;

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

/** Texto da medida ativa, na unidade certa. */
const exibir = (item: TotalTerritorial, medida: Medida) =>
  medida === "qtd" ? num(item.quantidade) : brl(item.valor);

/** A outra medida, que a tela mostra como complemento. */
const complemento = (item: TotalTerritorial, medida: Medida) =>
  medida === "qtd" ? brl(item.valor) : `${num(item.quantidade)} licitações`;

export function MapaTerritorio({ celulas, meses, medida }: Props) {
  const [etapa, setEtapa] = useState<EtapaDoFunil>("aderentes");
  const [agrupamento, setAgrupamento] = useState<"uf" | "regiao">("uf");
  const [regiao, setRegiao] = useState<Regiao | null>(null);
  const [uf, setUf] = useState<string | null>(null);
  const [esfera, setEsfera] = useState<Esfera | null>(null);

  /** Recorte de período — vale para tudo aqui dentro. */
  const doPeriodo = useMemo(() => filtrar(celulas, { meses }), [celulas, meses]);

  /**
   * ⚠️ Os cards de esfera são calculados ANTES do filtro de esfera, de
   * propósito: senão a esfera escolhida mostraria 100% e as outras zero,
   * justamente quando a comparação entre elas é o que interessa.
   */
  const antesDaEsfera = useMemo(() => filtrar(doPeriodo, { regiao }), [doPeriodo, regiao]);
  const recorte = useMemo(() => filtrar(antesDaEsfera, { esfera }), [antesDaEsfera, esfera]);

  /**
   * ⚠️ A escala de cor é calibrada pelo NACIONAL da mesma etapa, período e
   * esfera — nunca pelo recorte de região. Recalibrar ao escolher uma região
   * faria a mesma cor significar coisas diferentes na mesma sessão.
   */
  const nacional = useMemo(() => filtrar(doPeriodo, { esfera }), [doPeriodo, esfera]);

  const pintura = useMemo(() => {
    const base = agrupamento === "uf" ? porUf(nacional, etapa) : pintarPorRegiao(porRegiao(nacional, etapa));
    return base;
  }, [nacional, etapa, agrupamento]);

  const teto = useMemo(() => {
    if (agrupamento === "uf") return maximo(porUf(nacional, etapa).values(), medida);
    return maximo(porRegiao(nacional, etapa).values(), medida);
  }, [nacional, etapa, agrupamento, medida]);

  const totalNacional = useMemo(() => total(nacional, etapa), [nacional, etapa]);
  const totalDoRecorte = useMemo(() => total(recorte, etapa), [recorte, etapa]);
  const foraDoMapa = useMemo(() => semLocalizacao(recorte, etapa), [recorte, etapa]);

  const ranking = useMemo((): readonly LinhaDeRanking[] => {
    if (agrupamento === "regiao" && !regiao) {
      const mapa = porRegiao(recorte, etapa);
      return ordenarRanking(
        REGIOES.filter((r) => mapa.has(r)).map((r) => {
          const item = mapa.get(r) ?? { quantidade: 0, valor: null, semValor: 0 };
          return { chave: r, rotulo: r, total: item, medida: medidaDe(item, medida) };
        }),
      );
    }
    const mapa = porUf(recorte, etapa);
    return ordenarRanking(
      [...mapa.entries()].map(([sigla, item]) => ({
        chave: sigla,
        rotulo: `${sigla} · ${ufPorSigla(sigla)?.nome ?? sigla}`,
        total: item,
        medida: medidaDe(item, medida),
      })),
    );
  }, [recorte, etapa, agrupamento, regiao, medida]);

  /** Barras do ranking são relativas ao líder da lista, não ao país. */
  const lider = ranking[0]?.medida ?? null;

  const selecionado = useMemo(() => {
    const alvo = uf ? filtrar(recorte, {}).filter((c) => ufPorSigla(c.uf)?.sigla === uf) : recorte;
    return {
      escopo: uf ? `${uf} · ${ufPorSigla(uf)?.nome ?? uf}` : regiao ?? "Brasil",
      etapas: Object.fromEntries(etapasDoFunil.map((e) => [e, total(alvo, e)])) as Record<EtapaDoFunil, TotalTerritorial>,
    };
  }, [recorte, uf, regiao]);

  const esferas = useMemo(() => distribuicaoPorEsfera(antesDaEsfera, etapa, medida), [antesDaEsfera, etapa, medida]);
  const atuacao = useMemo(
    () => ordenarRanking(
      tabelaDeAtuacao(recorte, agrupamento === "regiao" && !regiao ? "regiao" : "uf").map((linha) => ({
        chave: linha.chave,
        rotulo: linha.rotulo,
        total: linha.etapas.aderentes,
        medida: medidaDe(linha.etapas.aderentes, medida),
      })),
    ).map((ordenada) => ({
      ...ordenada,
      etapas: tabelaDeAtuacao(recorte, agrupamento === "regiao" && !regiao ? "regiao" : "uf")
        .find((l) => l.chave === ordenada.chave)?.etapas,
    })),
    [recorte, agrupamento, regiao, medida],
  );

  const regioesDisponiveis = useMemo(() => regioesComDados(doPeriodo), [doPeriodo]);
  const ufsDisponiveis = useMemo(() => {
    const presentes = porUf(filtrar(doPeriodo, { esfera, regiao }), etapa);
    return UNIDADES_FEDERATIVAS.filter((item) => presentes.has(item.sigla));
  }, [doPeriodo, esfera, regiao, etapa]);

  /** Trocar de região invalida um estado de outra região. */
  const trocarRegiao = (nova: Regiao | null) => {
    setRegiao(nova);
    if (uf && nova && ufPorSigla(uf)?.regiao !== nova) setUf(null);
  };

  const alternarUf = (sigla: string) => setUf((atual) => (atual === sigla ? null : sigla));

  const clicarNoMapa = (sigla: string) => {
    if (agrupamento === "regiao" && !regiao) {
      const dele = ufPorSigla(sigla)?.regiao ?? null;
      trocarRegiao(dele);
      return;
    }
    alternarUf(sigla);
  };

  const limparMapa = () => {
    setEtapa("aderentes");
    setAgrupamento("uf");
    setRegiao(null);
    setUf(null);
    setEsfera(null);
  };

  const semDados = totalNacional.quantidade === 0;

  return (
    <div className="an-bloco an-terr">
      <div className="an-terr-cabeca">
        <div>
          <h2 id="an-h-mapa">Território &amp; oportunidades</h2>
          <p className="an-ajuda">
            Onde estão as licitações que o buscador acompanha, por estado e por esfera do órgão.
          </p>
        </div>
        <nav aria-label="Nível territorial" className="an-migalhas">
          <button onClick={() => { setRegiao(null); setUf(null); }} type="button">Brasil</button>
          {regiao ? <><span aria-hidden="true">›</span><button onClick={() => setUf(null)} type="button">{regiao}</button></> : null}
          {uf ? <><span aria-hidden="true">›</span><b>{uf}</b></> : null}
        </nav>
      </div>

      <div className="an-terr-ctrl">
        <div className="an-campo">
          <label htmlFor="an-m-etapa">Mostrar</label>
          <select id="an-m-etapa" onChange={(e) => setEtapa(e.target.value as EtapaDoFunil)} value={etapa}>
            {etapasDoFunil.map((item) => <option key={item} value={item}>{rotuloDaEtapa[item]}</option>)}
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
          <select
            id="an-m-regiao"
            onChange={(e) => trocarRegiao(e.target.value === "" ? null : (e.target.value as Regiao))}
            value={regiao ?? ""}
          >
            <option value="">Todas as regiões</option>
            {regioesDisponiveis.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="an-campo">
          <label htmlFor="an-m-uf">Estado</label>
          <select id="an-m-uf" onChange={(e) => setUf(e.target.value === "" ? null : e.target.value)} value={uf ?? ""}>
            <option value="">Todos os estados</option>
            {ufsDisponiveis.map((item) => <option key={item.sigla} value={item.sigla}>{item.sigla} · {item.nome}</option>)}
          </select>
        </div>
        <div className="an-campo">
          <label htmlFor="an-m-esfera">Esfera</label>
          <select id="an-m-esfera" onChange={(e) => setEsfera(e.target.value === "" ? null : (e.target.value as Esfera))} value={esfera ?? ""}>
            <option value="">Todas as esferas</option>
            {(Object.keys(rotuloDaEsfera) as Esfera[]).map((item) => (
              <option key={item} value={item}>{rotuloDaEsfera[item]}</option>
            ))}
          </select>
        </div>
        <button className="an-limpar" onClick={limparMapa} type="button">Limpar mapa</button>
      </div>

      <p className="an-escopo">
        Estes filtros valem só para esta seção — os cards do topo continuam nacionais. O mapa mostra a
        <b> sede do órgão que publicou</b>, não o local da obra.
        {foraDoMapa.quantidade > 0
          ? <> {num(foraDoMapa.quantidade)} licitação(ões) sem estado informado no portal ficam fora do mapa e dentro dos totais.</>
          : null}
      </p>

      {semDados
        ? <p className="an-sem">Nenhuma licitação neste recorte de período.</p>
        : (
          <div className="an-terr-grade">
            <figure className="an-mapa">
              <svg aria-label={`Mapa do Brasil — ${rotuloDaEtapa[etapa]}`} role="img" viewBox={VIEWBOX_DO_BRASIL}>
                <defs>
                  {/* Estado sem medida conhecida. Hachura, não uma cor: vazio e
                      desconhecido precisam ser distinguíveis de relance. */}
                  <pattern height="6" id="an-hachura" patternTransform="rotate(45)" patternUnits="userSpaceOnUse" width="6">
                    <rect fill="rgba(120,120,120,0.10)" height="6" width="6"/>
                    <line stroke="rgba(120,120,120,0.55)" strokeWidth="1.4" x1="0" x2="0" y1="0" y2="6"/>
                  </pattern>
                </defs>
                {UNIDADES_FEDERATIVAS.map((item) => {
                  // Ausente da agregação = não teve licitação, e isso é um
                  // zero conhecido. Ver `SEM_OCORRENCIA`.
                  const dele = pintura.get(item.sigla) ?? SEM_OCORRENCIA;
                  const nivel = nivelDeCor(medidaDe(dele, medida), teto);
                  const ativo = uf === item.sigla || (!uf && regiao === item.regiao);
                  const rotulo = `${item.nome}: ${
                    dele.quantidade === 0
                      ? "sem ocorrência"
                      : medidaDe(dele, medida) === null
                        ? "valor não informado"
                        : exibir(dele, medida)
                  }`;
                  return (
                    <path
                      aria-label={rotulo}
                      className={`an-uf n${nivel === null ? "x" : nivel}${ativo ? " sel" : ""}`}
                      d={item.contorno}
                      key={item.sigla}
                      onClick={() => clicarNoMapa(item.sigla)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); clicarNoMapa(item.sigla); }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <title>{rotulo}</title>
                    </path>
                  );
                })}
                {UNIDADES_FEDERATIVAS.map((item) => (
                  <text className="an-uf-sigla" key={`t-${item.sigla}`} x={item.rotuloX} y={item.rotuloY}>{item.sigla}</text>
                ))}
              </svg>
              <figcaption className="an-mapa-legenda">
                <span>Menos</span>
                {Array.from({ length: NIVEIS_DA_ESCALA }, (_, i) => <i className={`n${i + 1}`} key={i}/>)}
                <span>Mais</span>
                <span className="an-mapa-legenda-obs">
                  escala pelo maior {agrupamento === "uf" ? "estado" : "região"} do país nesta etapa
                  {esfera ? ` e esfera ${rotuloDaEsfera[esfera].toLowerCase()}` : ""}
                </span>
              </figcaption>
            </figure>

            <div className="an-terr-lado">
              <div className="an-terr-sel">
                <p className="an-rot">{selecionado.escopo}</p>
                <p className="an-n">{exibir(selecionado.etapas[etapa], medida)}</p>
                <p className="an-obs">
                  {rotuloDaEtapa[etapa]} · {complemento(selecionado.etapas[etapa], medida)} ·{" "}
                  {pct(participacao(medidaDe(selecionado.etapas[etapa], medida), medidaDe(totalNacional, medida)))} do país nesta etapa
                </p>
                <dl className="an-terr-etapas">
                  {etapasDoFunil.map((item) => (
                    <div key={item}>
                      <dt>{rotuloDaEtapa[item]}</dt>
                      <dd>{exibir(selecionado.etapas[item], medida)}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="an-rank">
                <p className="an-rot">
                  {agrupamento === "regiao" && !regiao ? "Ranking das regiões" : "Ranking dos estados"}
                  <span> · {ranking.length}</span>
                </p>
                <ol>
                  {ranking.map((linha, indice) => {
                    const largura = participacao(linha.medida, lider);
                    const ativo = agrupamento === "regiao" && !regiao ? regiao === linha.chave : uf === linha.chave;
                    return (
                      <li className={ativo ? "sel" : undefined} key={linha.chave}>
                        <button
                          onClick={() => (agrupamento === "regiao" && !regiao ? trocarRegiao(linha.chave as Regiao) : alternarUf(linha.chave))}
                          type="button"
                        >
                          <span className="an-rank-pos">{indice + 1}</span>
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
                {ranking.length === 0 ? <p className="an-sem">Nenhum estado com licitação neste recorte.</p> : null}
              </div>
            </div>
          </div>
        )}

      {semDados ? null : (
        <>
          <h3 className="an-terr-h3">De qual esfera vêm as oportunidades?</h3>
          <p className="an-ajuda">
            Distribuição de {rotuloDaEtapa[etapa].toLowerCase()} no recorte territorial, antes do filtro de esfera —
            para as alternativas continuarem comparáveis. Clique para filtrar.
          </p>
          <div className="an-esferas">
            {esferas.map((fatia) => (
              <button
                aria-pressed={esfera === fatia.esfera}
                className={`an-esfera${esfera === fatia.esfera ? " sel" : ""}`}
                key={fatia.esfera}
                onClick={() => setEsfera((atual) => (atual === fatia.esfera ? null : fatia.esfera))}
                type="button"
              >
                <span className="an-rot">{fatia.rotulo}</span>
                <span className="an-n">{exibir(fatia.total, medida)}</span>
                <span className="an-obs">{complemento(fatia.total, medida)} · {pct(fatia.percentual)} do recorte</span>
                <span aria-hidden="true" className="an-barra">
                  <i style={fatia.percentual === null ? undefined : { width: `${Math.min(100, fatia.percentual).toFixed(1)}%` }}/>
                </span>
              </button>
            ))}
          </div>

          <h3 className="an-terr-h3">Atuação por {agrupamento === "regiao" && !regiao ? "região" : "estado"}</h3>
          <div className="an-rolagem">
            <table>
              <thead>
                <tr>
                  <th scope="col">{agrupamento === "regiao" && !regiao ? "Região" : "Estado"}</th>
                  {etapasDoFunil.map((item) => <th key={item} scope="col">{rotuloDaEtapa[item]}</th>)}
                </tr>
              </thead>
              <tbody>
                {atuacao.map((linha) => (
                  <tr className={uf === linha.chave ? "sel" : undefined} key={linha.chave}>
                    <th scope="row">{linha.rotulo}</th>
                    {etapasDoFunil.map((item) => {
                      const celula = linha.etapas?.[item];
                      return (
                        <td key={item}>
                          {celula ? exibir(celula, medida) : "—"}
                          <small>{celula ? complemento(celula, medida) : ""}</small>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalDoRecorte.semValor > 0
            ? (
              <p className="an-ajuda">
                {num(totalDoRecorte.semValor)} licitação(ões) do recorte não informaram valor estimado (orçamento sigiloso):
                elas contam na quantidade e ficam fora das somas em reais.
              </p>
            )
            : null}
          <p className="an-fonte">
            Contorno dos estados: malha territorial do IBGE. Localização: unidade do órgão publicador, informada no PNCP.
          </p>
        </>
      )}
    </div>
  );
}
