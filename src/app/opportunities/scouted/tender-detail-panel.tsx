"use client";

// `TenderSummaryHeader` recebe `onDecided` (função) — a mesma classe de erro
// já vista em 28/08/2026 (ver server-component-event-handlers.test.ts): um
// componente assim tem de ser de cliente, senão o React derruba a
// renderização assim que houver alguma licitação na fila. Componente de
// cliente também é o que a janelinha do mapa da Análise precisa: ela é quem
// passa a função de verdade, e só componente de cliente pode ser instanciado
// de dentro de outro componente de cliente.
import type { Prisma } from "@/generated/prisma/client";
import { rotulosDeEsfera as sphereLabels } from "@/modules/scouting/domain/esfera";
import { compararAcervo, type SituacaoDoServico } from "@/modules/scouting/domain/comparativo-de-acervo";
import { summarize, type Prerequisite } from "@/modules/scouting/domain/prerequisites";
import type { ScoutWorkType } from "@/modules/scouting/domain/scout-filter";
import type { ScoredTender } from "@/modules/scouting/application/score-tender";
import { BaixarDocumentos } from "@/app/opportunities/scouted/baixar-documentos";
import { AdherenceGauge } from "./adherence-gauge";
import { Flag, SignalActions } from "./signal-actions";
import { ShareTenderAction } from "./share-tender-action";
import { TriageActions, type Decisao } from "./triage-actions";
// Este componente aparece fora de /opportunities/scouted também (janelinha do
// mapa da Análise): o import garante que as classes bx-* cheguem junto,
// mesmo quando page.tsx (que também importa este arquivo) não é o consumidor.
import "./scouted.css";

/** Encerra em menos de duas semanas: fica em destaque na linha e no medidor. */
const SHORT_DEADLINE_DAYS = 14;

export const workTypeLabels: Record<ScoutWorkType, string> = {
  BUILDING: "Edificação",
  SPECIAL_STRUCTURE: "Obra de arte especial",
  PAVING: "Pavimentação e rodovia",
  URBAN_INFRASTRUCTURE: "Infraestrutura urbana",
  SANITATION: "Saneamento e adutora",
  EARTHWORKS: "Contenção e terraplenagem",
  RENOVATION: "Reforma e retrofit",
};

const currency = (value: Prisma.Decimal | null, undisclosed: boolean) =>
  undisclosed || value === null ? null : Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * `tender` chega como `Date` de verdade quando a página o desenha no
 * servidor (a fila do Buscador), e como STRING ISO quando chega por
 * `fetch(...).then(r => r.json())` (a janelinha do mapa da Análise, que
 * busca o mesmo pacote por HTTP) — o JSON não tem tipo `Date`. `new Date(x)`
 * aceita os dois formatos sem diferença, então a formatação nunca precisa
 * saber de qual dos dois lados o dado veio.
 */
const dataCurta = (value: Date | string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("pt-BR") : undefined;

/** R$ em milhões, como o cartão os mostra. */
const dinheiroCurto = (valor: number) =>
  `R$ ${(valor / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div className="bx-item"><dt>{rotulo}</dt><dd>{valor}</dd></div>;
}

const tick = <svg aria-hidden="true" className="marca" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="m5 13 4 4L19 7"/></svg>;
const cross = <svg aria-hidden="true" className="marca" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>;
const dash = <svg aria-hidden="true" className="marca" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24"><path d="M6 12h12"/></svg>;
const bang = <svg aria-hidden="true" className="marca" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.6" viewBox="0 0 24 24"><path d="M12 6v8M12 18h.01"/></svg>;

/** Como cada situação do comparativo de acervo aparece na tela. */
const situacaoRotulo: Record<SituacaoDoServico, string> = {
  ATENDE: "Atende",
  NAO_ALCANCA: "Não alcança",
  FALTA: "Falta",
  SEM_COMPARACAO: "Sem comparar",
};

const situacaoClasse: Record<SituacaoDoServico, string> = {
  ATENDE: "atende",
  NAO_ALCANCA: "falha",
  FALTA: "falha",
  SEM_COMPARACAO: "pulado",
};

const marcaDoEstado = {
  MET: { icone: tick, classe: "atende" },
  NOT_MET: { icone: cross, classe: "falha" },
  ATTENTION: { icone: bang, classe: "atencao" },
  UNKNOWN: { icone: dash, classe: "pulado" },
} as const;

/**
 * Um pré-requisito e, quando ele é a soma de várias exigências, cada uma delas
 * pelo nome.
 *
 * O desdobramento nasceu de "os serviços requeridos ali têm de ser explícitos,
 * e quais a gente atende ou não" (21/09/2026): "2 serviço(s) comprovados" não
 * responde qual serviço falta, e é o nome do serviço que vira a conversa de
 * consórcio. A mesma lista existe na aba "Acervo técnico" — a repetição é de
 * propósito, porque é aqui que se decide participar, e mandar a pessoa trocar
 * de aba no meio da decisão era o atrito que se queria tirar.
 */
function PreRequisito({ requisito }: { requisito: Prerequisite }) {
  const marca = marcaDoEstado[requisito.status];
  return <div>
    <div className={`bx-motivo ${marca.classe}`}>
      {marca.icone}
      <span>
        <strong>{requisito.label}</strong>
        {" — "}{requisito.detail}
      </span>
    </div>
    {requisito.breakdown && <div className="bx-subitens">
      {requisito.breakdown.map((servico) => {
        const submarca = marcaDoEstado[servico.status];
        return <div className={`bx-motivo bx-subitem ${submarca.classe}`} key={servico.label}>
          {submarca.icone}
          <span>{servico.label}<span className="bx-subitem-nota"> — {servico.detail}</span></span>
        </div>;
      })}
    </div>}
  </div>;
}

function Motivo({ rotulo, met, skipped }: { rotulo: string; met: boolean; skipped: boolean }) {
  const estado = skipped ? "pulado" : met ? "atende" : "falha";
  return <div className={`bx-motivo ${estado}`}>
    {skipped ? dash : met ? tick : cross}
    <span>{rotulo}</span>
  </div>;
}

/**
 * Cabeçalho de UMA licitação: objeto, órgão, etiquetas, valor, prazo, medidor
 * e as ações de decisão — extraído do `<summary>` da linha da fila
 * (25/09/2026) pelo mesmo motivo do painel abaixo: a janelinha do mapa da
 * Análise precisa do mesmo conteúdo, sem o `<details>`/`<summary>` que só faz
 * sentido numa lista que expande e recolhe.
 */
export function TenderSummaryHeader({
  tender, canDecide, shareRecipients, duplicateCount, onDecided,
}: {
  tender: ScoredTender;
  canDecide: boolean;
  shareRecipients: readonly { id: string; email: string; label: string }[];
  duplicateCount: number;
  onDecided?: (decisao: Decisao) => void;
}) {
  const value = currency(tender.estimatedValue, tender.valueUndisclosed);
  const days = tender.days;
  const signal = tender.signal;
  return (
    <>
      {signal && <><span className="bx-terreno"/><span className="bx-bandeira"><Flag/></span></>}

      <div className="min-w-0">
        <p className="bx-objeto">{tender.subject}</p>
        <p className="bx-orgao">{tender.authorityName} · {tender.modality} · {sphereLabels[tender.sphere] ?? tender.sphere}</p>
        <div className="bx-etiquetas">
          {signal && <span className="bx-marca-p"><Flag size={13}/>{signal.label}</span>}
          {tender.adherence.workTypes.map((type) => <span className="bx-eti tipo" key={type}>{workTypeLabels[type] ?? type}</span>)}
          {tender.valueUndisclosed && <span className="bx-eti alerta">valor sigiloso</span>}
          {tender.adherence.reasons.filter((reason) => !reason.met && !reason.skipped && reason.criterion !== "SPHERE").map((reason) =>
            <span className="bx-eti alerta" key={reason.criterion}>{reason.label}</span>)}
          {!tender.archive.determined && <span className="bx-eti">acervo não julgado</span>}
          <span className={tender.edital ? (tender.edital.reviewedAt ? "bx-eti" : "bx-eti aviso") : "bx-eti"}>
            {tender.edital ? (tender.edital.reviewedAt ? "edital conferido" : "edital lido, a conferir") : "edital não lido"}
          </span>
          {(() => {
            const r = summarize(tender.prerequisites);
            return <span className={r.notMet > 0 ? "bx-eti alerta" : "bx-eti"}>
              {r.met}/{r.total} pré-requisitos{r.unknown > 0 ? ` · ${r.unknown} a conferir` : ""}
            </span>;
          })()}
          {duplicateCount > 0 && <span className="bx-eti aviso">
            possível republicação · {duplicateCount} outra(s) igual(is)
          </span>}
          {tender.archive.needsPartner && <span className="bx-eti alerta">
            consórcio{tender.archive.missing.length > 0
              ? `: falta ${tender.archive.missing.map((m) => m.label.toLowerCase()).join(", ")}`
              : ": porte"}
          </span>}
        </div>
      </div>

      <div className="bx-num">
        <p className={value ? "bx-valor" : "bx-valor sigiloso"}>{value ?? "Sigiloso"}</p>
        <p className="bx-local">{tender.city ? `${tender.city} / ${tender.state ?? ""}` : tender.state ?? "—"}</p>
      </div>

      <div className="bx-num bx-prazo">
        {days === undefined ? <p className="bx-local">—</p> : <>
          <p className={days <= SHORT_DEADLINE_DAYS ? "bx-dias curto" : "bx-dias"}>{days} dias</p>
          <p className="bx-data">{dataCurta(tender.proposalClosesAt)}</p>
        </>}
      </div>

      <div className="bx-medidor-caixa">
        <AdherenceGauge
          aria={tender.resumo.total === 0
            ? "Pré-requisitos não avaliados"
            : `Pré-requisitos atendidos: ${tender.resumo.met} de ${tender.resumo.total}`}
          score={tender.score}
          undetermined={tender.resumo.total === 0}
        />
        {tender.status !== "PENDING"
          ? <span className="bx-local block text-center">Esta licitação já foi triada.</span>
          : canDecide ? <TriageActions id={tender.id} onDecided={onDecided}/> : <span className="bx-local block text-center">Sem alçada para decidir</span>}
        <div className="bx-mini-acoes">
          <SignalActions id={tender.id} signal={signal ? { level: signal.level, label: signal.label, color: signal.color, ...(signal.note ? { note: signal.note } : {}) } : undefined}/>
          <ShareTenderAction id={tender.id} recipients={shareRecipients} subject={tender.subject}/>
        </div>
      </div>
    </>
  );
}

/**
 * Painel completo de UMA licitação rastreada — extraído de
 * `opportunities/scouted/page.tsx` (25/09/2026) para poder aparecer em dois
 * lugares com o mesmo conteúdo: a linha expansível da fila do Buscador, e a
 * janelinha que o mapa da Análise abre por cima de si mesmo. `tender` já
 * chega pontuado (`scoreTender`), então o painel só desenha — não recalcula
 * nada.
 */
export function TenderDetailPanel({ tender }: { tender: ScoredTender }) {
  const days = tender.days;
  return (
    <div className="bx-abas-painel">
      <div className="bx-abas-nav" role="tablist">
        <input aria-controls={`${tender.id}-p1`} className="bx-aba-rd" defaultChecked id={`${tender.id}-a1`} name={`aba-${tender.id}`} role="tab" type="radio"/>
        <label className="bx-aba-lbl" htmlFor={`${tender.id}-a1`}>Identificação</label>
        <input aria-controls={`${tender.id}-p2`} className="bx-aba-rd" id={`${tender.id}-a2`} name={`aba-${tender.id}`} role="tab" type="radio"/>
        <label className="bx-aba-lbl" htmlFor={`${tender.id}-a2`}>Prazos</label>
        <input aria-controls={`${tender.id}-p3`} className="bx-aba-rd" id={`${tender.id}-a3`} name={`aba-${tender.id}`} role="tab" type="radio"/>
        <label className="bx-aba-lbl" htmlFor={`${tender.id}-a3`}>
          Pré-requisitos
          {/* É este o número que decide participar — % dos requisitos
              da LICITAÇÃO atendidos (acervo, porte, prazo, valor, e o
              que o edital exige), nunca preferência de perfil. */}
          <span className="bx-aba-selo">{tender.score}%</span>
        </label>
        {tender.edital && <>
          <input aria-controls={`${tender.id}-p4`} className="bx-aba-rd" id={`${tender.id}-a4`} name={`aba-${tender.id}`} role="tab" type="radio"/>
          <label className="bx-aba-lbl" htmlFor={`${tender.id}-a4`}>Parcelas exigidas</label>
        </>}
        <input aria-controls={`${tender.id}-p5`} className="bx-aba-rd" id={`${tender.id}-a5`} name={`aba-${tender.id}`} role="tab" type="radio"/>
        <label className="bx-aba-lbl" htmlFor={`${tender.id}-a5`}>Acervo técnico</label>
        <input aria-controls={`${tender.id}-p6`} className="bx-aba-rd" id={`${tender.id}-a6`} name={`aba-${tender.id}`} role="tab" type="radio"/>
        <label className="bx-aba-lbl" htmlFor={`${tender.id}-a6`}>Aderência ao perfil</label>
        {tender.signal?.note && <>
          <input aria-controls={`${tender.id}-p7`} className="bx-aba-rd" id={`${tender.id}-a7`} name={`aba-${tender.id}`} role="tab" type="radio"/>
          <label className="bx-aba-lbl" htmlFor={`${tender.id}-a7`}>Sinalização</label>
        </>}
        <input aria-controls={`${tender.id}-p8`} className="bx-aba-rd" id={`${tender.id}-a8`} name={`aba-${tender.id}`} role="tab" type="radio"/>
        <label className="bx-aba-lbl" htmlFor={`${tender.id}-a8`}>Edital</label>
      </div>

      <dl className="bx-abas-corpo">
        <div className="bx-aba-painel" id={`${tender.id}-p1`}>
          <Linha rotulo="Órgão" valor={tender.authorityName}/>
          <Linha rotulo="Esfera" valor={sphereLabels[tender.sphere] ?? tender.sphere}/>
          <Linha rotulo="Modalidade" valor={tender.modality}/>
          <Linha rotulo="Processo" valor={tender.processNumber ?? "—"}/>
          <Linha rotulo="Localidade" valor={tender.city ? `${tender.city} / ${tender.state ?? ""}` : tender.state ?? "—"}/>
        </div>

        <div className="bx-aba-painel" id={`${tender.id}-p2`}>
          <Linha rotulo="Abertura das propostas" valor={dataCurta(tender.proposalOpensAt) ?? "—"}/>
          <Linha rotulo="Encerramento" valor={dataCurta(tender.proposalClosesAt) ?? "—"}/>
          <Linha rotulo="Dias restantes" valor={days === undefined ? "—" : `${days} dias`}/>
          <Linha rotulo="Captada em" valor={dataCurta(tender.createdAt) ?? "—"}/>
        </div>

        <div className="bx-aba-painel" id={`${tender.id}-p3`}>
          {/* Mesma contagem que já aparece na linha fechada da fila —
              só que lá ("3/8 pré-requisitos") e aqui não, obrigando a
              pessoa a contar ✓/– na mão pra saber o que atende. */}
          <p className="bx-aba-resumo">
            {tender.resumo.met} de {tender.resumo.total} atendidos
            {tender.resumo.notMet > 0 ? `, ${tender.resumo.notMet} não atende${tender.resumo.notMet > 1 ? "m" : ""}` : ""}
            {tender.resumo.unknown > 0 ? `, ${tender.resumo.unknown} a conferir` : ""}
          </p>
          {tender.prerequisites.map((requisito) => <PreRequisito key={requisito.id} requisito={requisito}/>)}
          <p className="bx-nota" style={{ borderTop: "1px solid var(--fio)" }}>
            {!tender.edital
              ? <>O que está marcado como <strong>a conferir</strong> depende de ler o edital. A leitura automática ainda não passou por esta licitação — a próxima chamada do agendador cobre a fila pendente por ordem de prazo.</>
              : tender.edital.reviewedAt
                ? <>Edital lido e <strong>conferido</strong> por uma pessoa em {dataCurta(tender.edital.reviewedAt)}.</>
                : <>Edital lido automaticamente e <strong>ainda não conferido</strong> por uma pessoa. Antes de montar proposta ou consórcio, confira as parcelas contra o PDF.</>}
          </p>
        </div>

        {tender.edital && <div className="bx-aba-painel" id={`${tender.id}-p4`}>
          {tender.edital.requirement.services.length > 0
            ? <div className="bx-parcelas">
              {tender.edital.requirement.services.map((parcela, indice) => <div className="bx-parcela" key={indice}>
                <span className="bx-parcela-nome">{parcela.description}</span>
                <span className="bx-parcela-qtd">
                  {parcela.quantity === undefined
                    ? "—"
                    : `${parcela.quantity.toLocaleString("pt-BR")}${parcela.unit ? ` ${parcela.unit}` : ""}`}
                </span>
              </div>)}
            </div>
            : <p className="bx-nota">A leitura não localizou lista de parcelas de maior relevância neste edital.</p>}
          {tender.archive.unreadable.length > 0 && <p className="bx-nota" style={{ borderTop: "1px solid var(--fio)" }}>
            <strong>Não conferido contra o acervo:</strong> {tender.archive.unreadable.join("; ")}. O sistema não soube classificar esta(s) parcela(s) — confira à mão.
          </p>}
          {tender.edital.requirement.limitations.length > 0 && <p className="bx-nota">
            <strong>A leitura não conseguiu determinar:</strong> {tender.edital.requirement.limitations.join("; ")}.
          </p>}
        </div>}

        <div className="bx-aba-painel" id={`${tender.id}-p5`}>
          {/* O placar antes de qualquer coisa: é a pergunta que a
              pessoa faz ao abrir a licitação — de quantos serviços
              exigidos eu tenho prova? */}
          <p className="bx-aba-resumo">
            {tender.archive.determined
              ? `${tender.archive.required.length - tender.archive.missing.length} de ${tender.archive.required.length} serviço(s)`
              : "não julgado"}
          </p>

          {tender.archive.determined && <div className="bx-placar">
            <span className="tem"><b>{tender.archive.required.length - tender.archive.missing.length}</b> comprovados</span>
            <span className="falta"><b>{tender.archive.missing.length}</b> faltando</span>
            {tender.archive.unreadable.length > 0
              && <span className="duvida"><b>{tender.archive.unreadable.length}</b> não conferidos</span>}
          </div>}

          {/* Confronto item a item, em vez de uma frase por serviço.
              Pedido de 22/09/2026: "preciso de especificidade, não só
              que a gente tem tantos atestados — comparativo
              qualitativo e quantitativo do acervo exigido pela
              licitação e quanto a gente tem em atestados". Os números
              já eram calculados e descartados; agora ficam lado a
              lado, exigência contra acervo. */}
          {tender.archive.required.length > 0 && <div className="bx-comparativo">
            <div className="bx-comp-cab">
              <span>Serviço exigido</span>
              <span>A licitação exige</span>
              <span>Nosso acervo</span>
              <span>Situação</span>
            </div>
            {compararAcervo(tender.archive.required).map((linha) => <div className="bx-comp-linha" key={linha.servico}>
              <span className="bx-comp-servico">{linha.servico}</span>
              <span className="bx-comp-num" data-rotulo="Exige">{linha.exigido}</span>
              <span className="bx-comp-num" data-rotulo="Temos">{linha.acervo}</span>
              <span className={`bx-comp-sit ${situacaoClasse[linha.situacao]}`}>{situacaoRotulo[linha.situacao]}</span>
              {linha.ressalva && <span className="bx-comp-ressalva">{linha.ressalva}</span>}
            </div>)}
          </div>}

          {/* Exigência que o catálogo não soube classificar não é
              "coberta" nem "faltando": ninguém a conferiu. */}
          {tender.archive.unreadable.map((texto) =>
            <Motivo key={texto} met={false} rotulo={`${texto} — o sistema não soube classificar; confira à mão`} skipped/>)}

          {!tender.archive.determined && tender.archive.reasons.map((reason) =>
            <Motivo key={reason} met={false} rotulo={reason} skipped/>)}

          {/* O PORTE sempre aparece, inclusive quando não deu para
              julgar. Ele saiu da nota justamente porque ficava invisível
              ali dentro, derrubando toda licitação para o mesmo número
              sem dizer por quê. */}
          {tender.archive.determined && (
            tender.archive.scale === "COVERED" && tender.archive.largestExecuted !== undefined
              ? <Motivo met rotulo={`Porte — já executou obra de ${dinheiroCurto(tender.archive.largestExecuted)}`} skipped={false}/>
              : tender.archive.scale === "BELOW" && tender.archive.largestExecuted !== undefined
                ? <Motivo met={false} rotulo={`Porte — maior obra executada foi ${dinheiroCurto(tender.archive.largestExecuted)}, contra ${tender.estimatedValue !== null && !tender.valueUndisclosed ? dinheiroCurto(Number(tender.estimatedValue)) : "o valor desta"}`} skipped={false}/>
                : <Motivo met={false} skipped rotulo={tender.valueUndisclosed || tender.estimatedValue === null
                    ? "Porte — não comparável: o órgão não revelou o orçamento"
                    : "Porte — não comparável: os atestados do acervo não têm valor de contrato cadastrado"}/>
          )}
          {tender.archive.needsPartner && <p className="bx-nota" style={{ borderTop: "1px solid var(--fio)" }}>
            <strong>Indica consórcio.</strong>{" "}
            {tender.archive.missing.length > 0
              ? `O acervo não comprova ${tender.archive.missing.map((m) => m.label.toLowerCase()).join(", ")}.`
              : "A obra é maior que qualquer uma já executada."}
          </p>}
          {/* `requirementInferred` fica true nos dois casos — sem edital
              lido, e com edital lido cuja lista de parcelas saiu vazia
              (formato de tabela não reconhecido). A mensagem tinha só uma
              frase para os dois ("ainda não é lido automaticamente"),
              dizendo "não lido" bem ao lado do bloco "Edital lido"
              mostrando data — achado 21/09/2026, na tela real. */}
          {tender.archive.requirementInferred && tender.archive.determined && <p className="bx-nota" style={{ borderTop: "1px solid var(--fio)" }}>
            Serviços <strong>estimados a partir do objeto</strong>.{" "}
            {tender.edital
              ? "O edital foi lido, mas a leitura não reconheceu a lista de parcelas de maior relevância nele — confira o PDF à mão."
              : "As parcelas de maior relevância exigidas de fato só constam do edital, que ainda não foi lido automaticamente."}
          </p>}
        </div>

        <div className="bx-aba-painel" id={`${tender.id}-p6`}>
          {/* Só o que é PREFERÊNCIA configurada — tipo de obra, valor,
              prazo, esfera. Não é o que decide participar (isso é a
              aba Pré-requisitos, com o % de verdade) — achado
              22/09/2026: misturar as duas coisas num "100%" só fazia
              parecer que a licitação estava liberada quando só o
              gosto configurado batia, não a exigência real. */}
          {tender.adherence.reasons.map((reason) => <Motivo key={reason.criterion} met={reason.met} rotulo={reason.label} skipped={reason.skipped}/>)}
        </div>

        {tender.signal?.note && <div className="bx-aba-painel" id={`${tender.id}-p7`}>
          <p className="bx-aba-resumo">{tender.signal.label}</p>
          <p className="bx-nota">{tender.signal.note}</p>
        </div>}

        <div className="bx-aba-painel" id={`${tender.id}-p8`}>
          {tender.edital
            ? <>
              {/* Procedência: sem cópia guardada, é isto que diz QUAL
                  arquivo foi lido — e o hash é o que denuncia edital
                  retificado depois da leitura. */}
              <Linha rotulo="Arquivo" valor={tender.edital.source.filename}/>
              <Linha rotulo="Lido em" valor={dataCurta(tender.edital.source.fetchedAt) ?? "—"}/>
              <Linha rotulo="SHA-256" valor={`${tender.edital.source.fileHash.slice(0, 12)}…`}/>
              {tender.edital.requirement.confidence !== undefined
                && <Linha rotulo="Confiança da leitura" valor={`${Math.round(tender.edital.requirement.confidence * 100)}%`}/>}
            </>
            : <p className="bx-nota">
              Acervo exigido, consórcio, garantia e visita técnica só constam do edital. Enquanto ele não for lido, a exigência acima é <strong>deduzida do objeto</strong>.
            </p>}
          {/* Três destinos diferentes, e é por isso que são três
              links — a versão de 21/09/2026 que apontava o botão de
              download para a PÁGINA do PNCP só abria o site, sem
              baixar nada, e o rótulo prometia download.

              1. O pacote: a rota busca no PNCP e devolve um zip com
                 todos os documentos publicados pelo órgão.
              2. O arquivo que a IA leu: `edital-relevance` o escolhe
                 pelas parcelas com quantitativo, e quase nunca é o
                 "EDITAL.pdf" — serve para conferir a leitura, não
                 para montar proposta.
              3. A origem: saída manual quando o pacote não fecha
                 (órgão fora do ar, anexo gigante). */}
          <div className="bx-links">
            {/* Botão, e não link: a sessão do Teams não acompanha
                navegação de topo. Ver baixar-documentos.tsx. */}
            <BaixarDocumentos id={tender.id}/>
            {tender.edital && <a className="bx-link" href={tender.edital.source.uri} rel="noreferrer" target="_blank">
              Arquivo lido pela IA
              <svg aria-hidden="true" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-8 8"/></svg>
            </a>}
            {tender.noticeUrl && <a className="bx-link" href={tender.noticeUrl} rel="noreferrer" target="_blank">
              Abrir no PNCP
              <svg aria-hidden="true" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-8 8"/></svg>
            </a>}
          </div>
          <p className="bx-nota">
            O download é montado na hora, direto do PNCP — nada fica guardado no G-SIPRO. Vem um <strong>.zip</strong> com todos os documentos, ou o próprio arquivo quando o órgão publica um só. Licitação com muitos projetos demora, e o que não couber vem listado num <strong>_NAO-INCLUIDOS.txt</strong> dentro do zip.
          </p>
        </div>
      </dl>
    </div>
  );
}
