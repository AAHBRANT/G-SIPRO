"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useMemo, useState, useSyncExternalStore } from "react";

import { UNIDADES_FEDERATIVAS, ufPorSigla } from "@/modules/analysis/domain/malha-uf";
import { caixaBase, caixaComZoom, limitarZoom } from "@/modules/analysis/domain/territorio";
import {
  agruparPorCidade,
  faixaDoPrazo,
  prazoDoGrupo,
  totaisPorUf,
  type FaixaDePrazo,
  type PontoDaFila,
} from "@/modules/scouting/domain/fila-no-mapa";
import { TriageActions } from "./triage-actions";

export type Vista = "lista" | "mapa" | "ambos";

/**
 * Vista escolhida, guardada no navegador de cada pessoa. Lida por
 * `useSyncExternalStore` e não por efeito: o servidor desenha sempre a vista
 * padrão e o navegador troca sem o aviso de setState dentro de efeito.
 */
const CHAVE_DA_VISTA = "gsipro-rastreadas-vista";
const VISTA_PADRAO: Vista = "ambos";
const EVENTO_DA_VISTA = "gsipro-rastreadas-vista";

function lerVista(): Vista {
  try {
    const salva = window.localStorage.getItem(CHAVE_DA_VISTA);
    return salva === "lista" || salva === "mapa" || salva === "ambos" ? salva : VISTA_PADRAO;
  } catch {
    return VISTA_PADRAO;
  }
}

export function gravarVista(vista: Vista) {
  try { window.localStorage.setItem(CHAVE_DA_VISTA, vista); } catch { /* navegador sem armazenamento: vale só nesta tela */ }
  window.dispatchEvent(new Event(EVENTO_DA_VISTA));
}

function assinarVista(avisar: () => void) {
  window.addEventListener("storage", avisar);
  window.addEventListener(EVENTO_DA_VISTA, avisar);
  return () => {
    window.removeEventListener("storage", avisar);
    window.removeEventListener(EVENTO_DA_VISTA, avisar);
  };
}

const moeda = (valor: number) => {
  if (valor >= 1e9) return `R$ ${(valor / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} bi`;
  if (valor >= 1e6) return `R$ ${(valor / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
};
const dataCurta = (iso: string | undefined) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const ROTULO_DO_PRAZO: Record<FaixaDePrazo, string> = { curto: "Até 14 dias", medio: "15 a 30 dias", folgado: "Mais de 30 dias", "sem-data": "Sem data" };

const VISTAS: readonly { valor: Vista; rotulo: string; icone: ReactNode }[] = [
  { valor: "lista", rotulo: "Lista", icone: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/> },
  { valor: "mapa", rotulo: "Mapa", icone: <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/></> },
  { valor: "ambos", rotulo: "Lista + mapa", icone: <><rect height="8" rx="1" width="18" x="3" y="3"/><path d="M3 15h18M3 20h18"/></> },
];

/**
 * A "Relação de rastreadas" com o seletor Lista / Mapa / Lista + mapa
 * (pedido do dono, prévia aprovada em 22/10/2026). A lista continua vindo
 * pronta do servidor (`children`); este componente só decide o que aparece
 * e desenha o mapa.
 */
export function FilaNoMapa({
  titulo, resumo, pontos, uf, canDecide, children,
}: {
  titulo: ReactNode;
  resumo: ReactNode;
  pontos: readonly PontoDaFila[];
  uf: string | undefined;
  canDecide: boolean;
  children: ReactNode;
}) {
  const vista = useSyncExternalStore(assinarVista, lerVista, () => VISTA_PADRAO);

  return <section className={`bx-mesa bx-vista-${vista}`}>
    <header className="bx-relacao">
      {titulo}
      <div className="bx-relacao-dir">
        <div aria-label="Como ver as rastreadas" className="bx-vistas" role="group">
          {VISTAS.map((opcao) => <button
            aria-pressed={vista === opcao.valor}
            key={opcao.valor}
            onClick={() => gravarVista(opcao.valor)}
            type="button"
          >
            <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">{opcao.icone}</svg>
            {opcao.rotulo}
          </button>)}
        </div>
        {resumo}
      </div>
    </header>

    {vista !== "lista" && <MapaDaFila canDecide={canDecide} key={uf ?? "BR"} pontos={pontos} uf={uf}/>}
    {vista !== "mapa" && <div>{children}</div>}
  </section>;
}

function MapaDaFila({ pontos, uf, canDecide }: { pontos: readonly PontoDaFila[]; uf: string | undefined; canDecide: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pintar, setPintar] = useState<"quantidade" | "valor">("quantidade");
  const [zoom, setZoom] = useState(1);
  const [escolhida, setEscolhida] = useState<string>();

  const ufAtual = ufPorSigla(uf);
  const caixa = caixaComZoom(caixaBase(ufAtual), zoom, null);
  // Escala do desenho: rótulo e ponto mantêm o tamanho na tela ao aproximar.
  const escala = 730 / caixa.largura;

  const totais = useMemo(() => totaisPorUf(pontos), [pontos]);
  const maximo = Math.max(1, ...[...totais.values()].map((t) => t[pintar]));
  const nivel = (valor: number) => (valor <= 0 ? 0 : Math.min(5, Math.ceil((valor / maximo) * 5)));
  const doRecorte = uf ? pontos.filter((p) => p.uf === uf) : pontos;
  const grupos = useMemo(() => agruparPorCidade(doRecorte), [doRecorte]);
  const ficha = escolhida ? pontos.find((p) => p.id === escolhida) : undefined;

  function irPara(sigla: string | undefined) {
    const next = new URLSearchParams(params.toString());
    if (sigla) next.set("uf", sigla); else next.delete("uf");
    const search = next.toString();
    router.push(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  const totalDoRecorte = doRecorte.reduce((soma, p) => soma + (p.sigiloso ? 0 : p.valor ?? 0), 0);
  const curtas = doRecorte.filter((p) => faixaDoPrazo(p.dias) === "curto").length;
  const comRequisitos = doRecorte.filter((p) => p.totalDeRequisitos > 0);
  const aderenciaMedia = comRequisitos.length ? Math.round(comRequisitos.reduce((s, p) => s + p.score, 0) / comRequisitos.length) : undefined;
  const ranking = [...totais.entries()].sort((a, b) => b[1][pintar] - a[1][pintar]).slice(0, 6);
  const topo = Math.max(1, ...ranking.map(([, t]) => t[pintar]));

  return <div className="bx-mapa-zona" id="mapa">
    <div className="bx-mapa-col">
      <div className="bx-mapa-ferramentas">
        <span className="bx-mapa-dica">Clique em um estado para filtrar a lista. Clique num ponto para ver a licitação.</span>
        <div className="bx-mapa-botoes">
          <div aria-label="Pintar estados por" className="bx-mapa-seg" role="group">
            <button aria-pressed={pintar === "quantidade"} onClick={() => setPintar("quantidade")} type="button">Quantidade</button>
            <button aria-pressed={pintar === "valor"} onClick={() => setPintar("valor")} type="button">Valor</button>
          </div>
          <div className="bx-mapa-zoom">
            <button aria-label="Afastar" disabled={zoom <= 1} onClick={() => setZoom((z) => limitarZoom(z / 1.5))} type="button">−</button>
            <button aria-label="Aproximar" onClick={() => setZoom((z) => limitarZoom(z * 1.5))} type="button">+</button>
            <button disabled={!uf && zoom === 1} onClick={() => { setZoom(1); setEscolhida(undefined); irPara(undefined); }} type="button">Ver o Brasil</button>
          </div>
        </div>
      </div>

      <svg aria-label="Mapa do Brasil com as licitações rastreadas" className="bx-mapa" role="img" viewBox={`${caixa.x} ${caixa.y} ${caixa.largura} ${caixa.altura}`}>
        {UNIDADES_FEDERATIVAS.map((estado) => {
          const total = totais.get(estado.sigla);
          return <path
            className={`bx-mapa-uf n${nivel(total?.[pintar] ?? 0)}${uf && uf !== estado.sigla ? " apagado" : ""}`}
            d={estado.contorno}
            key={estado.sigla}
            onClick={() => { setEscolhida(undefined); irPara(uf === estado.sigla ? undefined : estado.sigla); }}
          >
            <title>{`${estado.nome}: ${total?.quantidade ?? 0} na fila${total?.valor ? ` · ${moeda(total.valor)}` : ""}`}</title>
          </path>;
        })}
        {UNIDADES_FEDERATIVAS.map((estado) => <text
          className="bx-mapa-sigla"
          key={estado.sigla}
          style={{ fontSize: 9 / escala, strokeWidth: 2.4 / escala }}
          textAnchor="middle"
          x={estado.rotuloX}
          y={estado.rotuloY}
        >{estado.sigla}</text>)}
        {grupos.map((grupo) => {
          const varias = grupo.pontos.length > 1;
          const raio = (varias ? 7.5 : 5.4) / Math.sqrt(escala);
          const ativa = grupo.pontos.some((p) => p.id === escolhida);
          const primeira = grupo.pontos[0]!;
          return <g
            className={`bx-mapa-ponto ${faixaDoPrazo(prazoDoGrupo(grupo))}${ativa ? " ativo" : ""}`}
            key={grupo.chave}
            onClick={() => setEscolhida(ativa && !varias ? undefined : grupo.pontos[varias ? (grupo.pontos.findIndex((p) => p.id === escolhida) + 1) % grupo.pontos.length : 0]!.id)}
            transform={`translate(${grupo.x} ${grupo.y})`}
          >
            <title>{`${primeira.cidade ?? ""} / ${primeira.uf ?? ""}: ${grupo.pontos.length} licitação(ões)${varias ? " — clique de novo para ver a próxima" : ""}`}</title>
            <circle className="halo" r={raio * 2.4}/>
            <circle className="miolo" r={raio} strokeWidth={1.5 / Math.sqrt(escala)}/>
            {varias && <text dy={2.7 / Math.sqrt(escala)} style={{ fontSize: 7.5 / Math.sqrt(escala) }} textAnchor="middle">{grupo.pontos.length}</text>}
          </g>;
        })}
      </svg>

      <div className="bx-mapa-legenda">
        <span className="escala">0 {[0, 1, 2, 3, 4, 5].map((n) => <i className={`n${n}`} key={n}/>)} {pintar === "quantidade" ? `${maximo} na fila` : moeda(maximo)}</span>
        {(["curto", "medio", "folgado"] as const).map((faixa) => <span className={`ponto ${faixa}`} key={faixa}><i/>{ROTULO_DO_PRAZO[faixa]}</span>)}
        <span className="ponto varias"><i/>Prazo mais curto da cidade</span>
      </div>
    </div>

    <aside className="bx-mapa-lado">
      <div>
        <p className="bx-mapa-k">Território selecionado</p>
        <p className="bx-mapa-nome">{ufAtual?.nome ?? "Brasil"}</p>
        <p className="bx-mapa-grande">{doRecorte.length}</p>
        <p className="bx-mapa-sub">na fila{totalDoRecorte > 0 ? ` · ${moeda(totalDoRecorte)}` : ""}</p>
      </div>
      <dl className="bx-mapa-fatos">
        <div><dt>Prazo curto</dt><dd>{curtas}</dd></div>
        <div><dt>Pré-requisitos (média)</dt><dd>{aderenciaMedia === undefined ? "—" : `${aderenciaMedia}%`}</dd></div>
      </dl>

      {ficha ? <FichaDaLicitacao
        canDecide={canDecide}
        onDecidida={() => { setEscolhida(undefined); router.refresh(); }}
        onFechar={() => setEscolhida(undefined)}
        ponto={ficha}
      /> : !uf && ranking.length > 0 && <div>
        <p className="bx-mapa-k">Estados com mais {pintar === "quantidade" ? "licitações" : "valor"}</p>
        <ol className="bx-mapa-ranking">
          {ranking.map(([sigla, total], indice) => <li key={sigla}>
            <button onClick={() => irPara(sigla)} type="button">
              <span className="pos">{String(indice + 1).padStart(2, "0")}</span>
              <span>{sigla} · {ufPorSigla(sigla)?.nome ?? sigla}</span>
              <span className="val">{pintar === "quantidade" ? total.quantidade : moeda(total.valor)}</span>
              <span className="barra"><i style={{ width: `${(total[pintar] / topo) * 100}%` }}/></span>
            </button>
          </li>)}
        </ol>
      </div>}
    </aside>
  </div>;
}

/** Ficha compacta: grade 2 × 2 simétrica e as duas ações do mesmo tamanho. */
function FichaDaLicitacao({ ponto, canDecide, onDecidida, onFechar }: {
  ponto: PontoDaFila;
  canDecide: boolean;
  onDecidida: () => void;
  onFechar: () => void;
}) {
  const faixa = faixaDoPrazo(ponto.dias);
  return <div className="bx-ficha">
    <div className="bx-ficha-topo">
      <span className="bx-mapa-k">Licitação escolhida</span>
      <span className={`bx-ficha-prazo ${faixa}`}>{ponto.dias === undefined ? "sem data" : `${ponto.dias} dias`}</span>
      <button aria-label="Fechar ficha" className="bx-ficha-fechar" onClick={onFechar} type="button">✕</button>
    </div>
    <div className="bx-ficha-corpo">
      <div>
        <p className="bx-ficha-objeto">{ponto.subject}</p>
        <p className="bx-ficha-orgao">{ponto.authorityName}</p>
      </div>
      <dl className="bx-ficha-fatos">
        <div><dt>Valor</dt><dd>{ponto.sigiloso || ponto.valor === undefined ? "Sigiloso" : moeda(ponto.valor)}</dd></div>
        <div><dt>Prazo</dt><dd className={faixa === "curto" ? "curto" : undefined}>{dataCurta(ponto.encerramento)}</dd></div>
        <div><dt>Local</dt><dd>{ponto.cidade ? `${ponto.cidade} / ${ponto.uf ?? ""}` : ponto.uf ?? "—"}</dd></div>
        <div><dt>Pré-requisitos</dt><dd>{ponto.totalDeRequisitos ? `${ponto.atendidos} de ${ponto.totalDeRequisitos}` : "não avaliados"}</dd></div>
      </dl>
      {canDecide ? <TriageActions id={ponto.id} onDecided={onDecidida}/> : <p className="bx-local">Sem alçada para decidir</p>}
      <a className="bx-ficha-link" href={`#${ponto.id}`} onClick={() => { if (lerVista() === "mapa") gravarVista("ambos"); }}>Ver detalhes na lista ↓</a>
    </div>
  </div>;
}
