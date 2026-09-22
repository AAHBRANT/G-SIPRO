"use client";

import { useState } from "react";

import {
  percentual,
  proporcaoDeBarra,
  rotuloDaEtapa,
  taxaMensal,
  totaisDoPeriodo,
  type EtapaDoFunil,
  type MesDoFunil,
} from "@/modules/analysis/domain/funil-comercial";

/**
 * Interação da tela de Análise: período, medida, abas e painel de detalhe.
 *
 * Roda no cliente porque é tudo estado de tela; os números vêm prontos do
 * servidor, já agregados por mês, e aqui só se recorta o período e se troca a
 * medida. Nenhuma licitação individual atravessa a fronteira.
 *
 * ⚠️ Toda proporção passa por `proporcaoDeBarra`, que devolve nulo quando não
 * há como calcular. Largura inválida é descartada pelo navegador e a barra
 * aparece CHEIA — ausência de dado ficaria idêntica a "converteu tudo".
 */

type Props = Readonly<{
  meses: readonly MesDoFunil[];
  semValor: number;
  atualizadoEm: string;
}>;

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const rotuloCurto = (mes: string) => {
  const indice = Number(mes.slice(5, 7)) - 1;
  return MESES_CURTOS[indice] ?? mes.slice(0, 7);
};

const num = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR"));

const brl = (v: number | null) => {
  if (v === null) return "—";
  if (Math.abs(v) >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} bi`;
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  return `R$ ${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
};

const pctTexto = (a: number | null, b: number | null) => {
  const p = percentual(a, b);
  return p === null ? "—" : `${p.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
};

function Barra({ a, b, rotulo }: { a: number | null; b: number | null; rotulo: string }) {
  const proporcao = proporcaoDeBarra(a, b);
  if (!proporcao) return <div aria-label="Proporção indisponível" className="an-barra indisponivel" role="img"/>;
  return (
    <div
      aria-label={proporcao.transbordo ? `${rotulo} — acima do total da etapa anterior, verificar duplicidade` : rotulo}
      className={`an-barra${proporcao.transbordo ? " transbordo" : ""}`}
      role="img"
    >
      <i style={{ width: `${proporcao.largura.toFixed(1)}%` }}/>
    </div>
  );
}

export function AnalisePainel({ meses, semValor, atualizadoEm }: Props) {
  const [janela, setJanela] = useState(6);
  const [medida, setMedida] = useState<"qtd" | "val">("qtd");
  const [aba, setAba] = useState(0);
  const [etapaGrafico, setEtapaGrafico] = useState<EtapaDoFunil>("aprovadas");
  const [detalhe, setDetalhe] = useState<EtapaDoFunil | null>(null);

  const recorte = meses.slice(Math.max(0, meses.length - janela));
  const resumo = totaisDoPeriodo(recorte);
  const valorDe = (etapa: number) => (medida === "qtd" ? resumo.etapas[etapa]?.quantidade ?? null : resumo.etapas[etapa]?.valor ?? null);
  const texto = (etapa: number) => (medida === "qtd" ? num(resumo.etapas[etapa]?.quantidade ?? null) : brl(resumo.etapas[etapa]?.valor ?? null));

  const aderentes = resumo.etapas[0];
  const orcamento = resumo.etapas[2];
  const propostas = resumo.etapas[3];
  const perdidoNoEstudo = orcamento?.valor !== null && orcamento?.valor !== undefined && propostas?.valor !== null && propostas?.valor !== undefined
    ? orcamento.valor - propostas.valor
    : null;
  const perdidoQtd = orcamento && propostas ? orcamento.quantidade - propostas.quantidade : null;

  const serieTaxa = taxaMensal(recorte, etapaGrafico, "aderentes");
  const topoGrafico = recorte.reduce((maior, mes) => {
    const v = medida === "qtd" ? mes.quantidade.aderentes : mes.valor.aderentes;
    return v !== null && v > maior ? v : maior;
  }, 0);

  const detalhado = detalhe === null ? null : resumo.etapas.find((e) => e.etapa === detalhe) ?? null;
  const indiceDetalhado = detalhado ? resumo.etapas.indexOf(detalhado) : -1;

  return (
    <div className="an">
      <div className="an-controles">
        <div className="an-campo">
          <label htmlFor="an-periodo">Período</label>
          <select id="an-periodo" onChange={(e) => setJanela(Number(e.target.value))} value={janela}>
            <option value={6}>Últimos 6 meses</option>
            <option value={3}>Últimos 3 meses</option>
            <option value={1}>Último mês</option>
          </select>
        </div>
        <div className="an-campo">
          <span className="an-rot-grupo" id="an-rot-medida">Medida</span>
          <div aria-labelledby="an-rot-medida" className="an-alterna" role="group">
            <button aria-pressed={medida === "qtd"} onClick={() => setMedida("qtd")} type="button">Quantidade</button>
            <button aria-pressed={medida === "val"} onClick={() => setMedida("val")} type="button">Valor em R$</button>
          </div>
        </div>
        <div className="an-espaco"/>
        <span className="an-corte">Coorte por mês de entrada na fila · dados até {atualizadoEm}</span>
      </div>

      {/* O que depende do time vem antes do volume, que cresce sozinho. */}
      <div className="an-resultado">
        <div className="an-peca">
          <span className="an-rot">Propostas enviadas no período</span>
          <span className="an-n">{brl(propostas?.valor ?? null)}</span>
          <span className="an-obs">{num(propostas?.quantidade ?? null)} licitações · ticket médio {brl(propostas?.ticketMedio ?? null)}</span>
        </div>
        <div className="an-peca secundaria">
          <span className="an-rot">Aproveitamento do perfil</span>
          <span className="an-n">{pctTexto(propostas?.quantidade ?? null, aderentes?.quantidade ?? null)}</span>
          <span className="an-obs">{num(propostas?.quantidade ?? null)} de {num(aderentes?.quantidade ?? null)} aderentes</span>
        </div>
        <div className="an-peca secundaria">
          <span className="an-rot">Orçamento que não virou proposta</span>
          <span className="an-n">{brl(perdidoNoEstudo)}</span>
          <span className="an-obs">{num(perdidoQtd)} orçamentos concluídos sem envio</span>
        </div>
      </div>

      <div className="an-cards">
        {resumo.etapas.map((etapa, indice) => {
          const anterior = indice === 0 ? null : resumo.etapas[indice - 1];
          const base = anterior
            ? (medida === "qtd" ? anterior.quantidade : anterior.valor)
            : (medida === "qtd" ? resumo.publicados : null);
          const rotuloBase = anterior ? `de ${anterior.rotulo.toLowerCase()}` : "dos editais lidos no portal";
          const legenda = base === null ? "comparação em R$ indisponível" : `${pctTexto(valorDe(indice), base)} ${rotuloBase}`;
          return (
            <article className="an-card" key={etapa.etapa}>
              <div className="an-card-topo">
                <svg aria-hidden="true" fill="none" focusable="false" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 19h16M7 16V9m5 7V5m5 11v-4"/></svg>
                <span>{etapa.rotulo}</span>
              </div>
              <p className="an-card-n">{texto(indice)}</p>
              <p className="an-card-comp">
                {medida === "qtd" ? `${brl(etapa.valor)} estimados` : `${num(etapa.quantidade)} licitações`}
                <br/><span>{legenda}</span>
              </p>
              <Barra a={valorDe(indice)} b={base} rotulo={legenda}/>
              <div className="an-card-pe">
                <button aria-haspopup="dialog" onClick={() => setDetalhe(etapa.etapa)} type="button">Ver detalhes</button>
              </div>
            </article>
          );
        })}
      </div>

      <div aria-label="Seções da análise" className="an-abas" role="group">
        {["Visão geral", "Aderência e funil", "Desempenho", "Indicadores"].map((rotulo, indice) => (
          <button aria-pressed={aba === indice} className="an-aba" key={rotulo} onClick={() => setAba(indice)} type="button">{rotulo}</button>
        ))}
      </div>

      <section aria-labelledby="an-h-funil" hidden={!(aba === 0 || aba === 1)}>
        <div className="an-bloco">
          <h2 id="an-h-funil">Funil</h2>
          <p className="an-ajuda">Cada etapa é acumulada, não uma fatia. O percentual é sobre o que é aderente ao perfil.</p>
          {resumo.etapas.map((etapa, indice) => {
            const rot = indice === 0 ? "base de comparação" : `${pctTexto(valorDe(indice), valorDe(0))} dos aderentes`;
            const proporcao = proporcaoDeBarra(valorDe(indice), valorDe(0));
            return (
              <button aria-haspopup="dialog" className="an-etapa" key={etapa.etapa} onClick={() => setDetalhe(etapa.etapa)} type="button">
                <span className="an-etapa-nome">{etapa.rotulo}</span>
                <span aria-label={rot} className="an-etapa-trilha" role="img">
                  {proporcao && <i style={{ width: `${proporcao.largura.toFixed(1)}%` }}/>}
                </span>
                <span className="an-etapa-num"><b>{texto(indice)}</b><span>{rot}</span></span>
              </button>
            );
          })}
          {semValor > 0 && (
            <p className="an-aviso">
              <b>{semValor} licitação(ões) sem valor estimado</b> no período. Elas entram na contagem, mas não no valor —
              por isso o total em reais é o que se sabe, não o que existe.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="an-h-meses" hidden={!(aba === 0 || aba === 2)}>
        <div className="an-bloco">
          <h2 id="an-h-meses">Evolução mensal</h2>
          <p className="an-ajuda">
            O número acima de cada mês é a <b>taxa de aproveitamento</b> — é ela que depende do time, enquanto o volume
            depende de quanto o portal publicou. Barra cinza: tudo que foi aderente no mês. Barra vinho: a etapa escolhida.
          </p>
          <div className="an-campo" style={{ marginBottom: 10 }}>
            <label htmlFor="an-etapa-mes">Etapa</label>
            <select id="an-etapa-mes" onChange={(e) => setEtapaGrafico(e.target.value as EtapaDoFunil)} value={etapaGrafico}>
              <option value="aprovadas">{rotuloDaEtapa.aprovadas}</option>
              <option value="orcamento">{rotuloDaEtapa.orcamento}</option>
              <option value="propostas">{rotuloDaEtapa.propostas}</option>
            </select>
          </div>
          {recorte.length === 0 || topoGrafico <= 0 ? (
            <p className="an-sem">Sem movimento no período.</p>
          ) : (
            <>
              <p className="an-escala">Escala: 0 a {medida === "qtd" ? `${num(topoGrafico)} licitações` : brl(topoGrafico)} por mês</p>
              <div className="an-meses">
                {recorte.map((mes, indice) => {
                  const base = medida === "qtd" ? mes.quantidade.aderentes : mes.valor.aderentes;
                  const serie = medida === "qtd" ? mes.quantidade[etapaGrafico] : mes.valor[etapaGrafico];
                  const alturaBase = proporcaoDeBarra(base, topoGrafico);
                  const alturaSerie = proporcaoDeBarra(serie, topoGrafico);
                  const taxa = serieTaxa[indice];
                  const rotuloTaxa = taxa === null || taxa === undefined
                    ? "—"
                    : `${taxa.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
                  return (
                    <div className="an-mes" key={mes.mes}>
                      <span className="an-mes-valor">{rotuloTaxa}</span>
                      <span aria-hidden="true" className="an-mes-barras">
                        <i className="base" style={{ height: `${alturaBase ? alturaBase.largura.toFixed(1) : 0}%` }}/>
                        <i className="serie" style={{ height: `${alturaSerie ? alturaSerie.largura.toFixed(1) : 0}%` }}/>
                      </span>
                      <span className="an-mes-rot">{rotuloCurto(mes.mes)}</span>
                      <span className="an-sr">
                        {rotuloCurto(mes.mes)}: {rotuloDaEtapa[etapaGrafico]} {num(serie)} de {num(base)} aderentes no mês ({rotuloTaxa})
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="an-h-tabela" hidden={!(aba === 0 || aba === 3)}>
        <div className="an-bloco">
          <h2 id="an-h-tabela">Indicadores por etapa</h2>
          <p className="an-ajuda">O mesmo período dos cards e do gráfico. Clique no nome da etapa para abrir o detalhe.</p>
          <div className="an-rolagem">
            <table>
              <caption className="an-sr">Indicadores por etapa, contando licitações distintas no período selecionado</caption>
              <thead>
                <tr>
                  <th scope="col">Etapa</th><th scope="col">Quantidade</th><th scope="col">% dos aderentes</th>
                  <th scope="col">Valor estimado</th><th scope="col">% do valor aderente</th>
                  <th scope="col">Taxa de aproveitamento</th><th scope="col">Ticket médio</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Editais lidos no portal</td><td>{num(resumo.publicados)}</td>
                  <td className="an-sem">—</td><td className="an-sem">indisponível</td>
                  <td className="an-sem">—</td><td className="an-sem">—</td><td className="an-sem">—</td>
                </tr>
                {resumo.etapas.map((etapa, indice) => {
                  const anterior = indice === 0 ? null : resumo.etapas[indice - 1];
                  return (
                    <tr className="an-clicavel" key={etapa.etapa}>
                      <td>
                        <button aria-haspopup="dialog" className="an-cel-btn" onClick={() => setDetalhe(etapa.etapa)} type="button">{etapa.rotulo}</button>
                      </td>
                      <td>{num(etapa.quantidade)}</td>
                      <td>{indice === 0 ? <span className="an-sem">base</span> : pctTexto(etapa.quantidade, aderentes?.quantidade ?? null)}</td>
                      <td>{brl(etapa.valor)}</td>
                      <td>{indice === 0 ? <span className="an-sem">base</span> : pctTexto(etapa.valor, aderentes?.valor ?? null)}</td>
                      <td>{anterior ? pctTexto(valorDe(indice), medida === "qtd" ? anterior.quantidade : anterior.valor) : <span className="an-sem">—</span>}</td>
                      <td>{brl(etapa.ticketMedio)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {detalhado && (
        <>
          <div className="an-capa" onClick={() => setDetalhe(null)}/>
          <aside aria-labelledby="an-detalhe-titulo" aria-modal="true" className="an-detalhe" role="dialog">
            <div className="an-detalhe-topo">
              <h3 id="an-detalhe-titulo">{detalhado.rotulo}</h3>
              <button aria-label="Fechar detalhe" className="an-fechar" onClick={() => setDetalhe(null)} type="button">✕</button>
            </div>
            <p className="an-detalhe-n">{medida === "qtd" ? `${num(detalhado.quantidade)} licitações` : brl(detalhado.valor)}</p>
            <dl>
              <dt>Valor estimado</dt><dd>{brl(detalhado.valor)}</dd>
              <dt>Ticket médio</dt><dd>{brl(detalhado.ticketMedio)}</dd>
              <dt>% dos aderentes</dt><dd>{pctTexto(detalhado.quantidade, aderentes?.quantidade ?? null)}</dd>
              <dt>% dos editais lidos</dt><dd>{pctTexto(detalhado.quantidade, resumo.publicados)}</dd>
            </dl>
            <p className="an-detalhe-rot">Distribuição mensal</p>
            <div aria-label={`Distribuição mensal: ${recorte.map((m) => `${rotuloCurto(m.mes)} ${m.quantidade[detalhado.etapa]}`).join(", ")}`} className="an-mini" role="img">
              {(() => {
                const topo = recorte.reduce((maior, m) => Math.max(maior, m.quantidade[detalhado.etapa]), 0);
                return recorte.map((m) => {
                  const altura = proporcaoDeBarra(m.quantidade[detalhado.etapa], topo);
                  return <div key={m.mes} style={{ height: `${altura ? altura.largura.toFixed(1) : 0}%` }}/>;
                });
              })()}
            </div>
            <div className="an-mini-rot">{recorte.map((m) => <span key={m.mes}>{rotuloCurto(m.mes)}</span>)}</div>
            <p className="an-explica">
              {indiceDetalhado === 0 && "Editais que a varredura leu no portal e que bateram com o perfil de obra da empresa. É a base de comparação do funil."}
              {indiceDetalhado === 1 && "Licitações que alguém da equipe aprovou na triagem. Cada aprovação vira uma oportunidade."}
              {indiceDetalhado === 2 && "Oportunidades com análise concluída. O mês é o de entrada na fila, não o da conclusão do estudo."}
              {indiceDetalhado === 3 && "Licitações com envio de proposta registrado, com protocolo. Conta licitação, nunca revisão de proposta."}
            </p>
          </aside>
        </>
      )}
    </div>
  );
}
