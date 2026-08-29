import type { CSSProperties } from "react";

import Link from "next/link";

import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { computeAdherence, resolveWorkTypes, type AdherenceInput } from "@/modules/scouting/domain/adherence";
import { computeArchiveAdherence } from "@/modules/scouting/domain/archive-adherence";
import { regionOf, regions, statesOfRegions } from "@/modules/scouting/domain/regions";
import { defaultScoutFilter, scoutWorkTypes, type ScoutFilter, type ScoutWorkType } from "@/modules/scouting/domain/scout-filter";
import { themeVariants } from "@/modules/scouting/domain/signal";
import { PrismaArchiveEvidenceRepository, PrismaScoutRepository } from "@/modules/scouting/infrastructure/prisma-scouting-repository";
import { AdherenceGauge } from "./adherence-gauge";
import { ScoutedFilters, type FilterGroup } from "./scouted-filters";
import { Flag, SignalActions } from "./signal-actions";
import { ThemeToggle, themeBootScript, THEME_ROOT_ID } from "./theme-toggle";
import { TriageActions } from "./triage-actions";
import "./scouted.css";

const PAGE_SIZE = 60;
const SHORT_DEADLINE_DAYS = 14;
/** Aderência não existe no banco: filtrar por ela obriga a trazer o conjunto e
 *  contar aqui. O teto evita que a fila cresça sem limite dentro de um pedido;
 *  quando ele é atingido a tela diz, em vez de cortar calada. */
const QUEUE_CAP = 900;
/** Abaixo disto a licitação contraria o perfil em mais de um critério. */
const OFF_PROFILE = 50;

const sphereLabels: Record<string, string> = { F: "Federal", E: "Estadual", M: "Municipal", D: "Distrital" };
const workTypeLabels: Record<ScoutWorkType, string> = {
  BUILDING: "Edificação",
  SPECIAL_STRUCTURE: "Obra de arte especial",
  PAVING: "Pavimentação e rodovia",
  URBAN_INFRASTRUCTURE: "Infraestrutura urbana",
  SANITATION: "Saneamento e adutora",
  EARTHWORKS: "Contenção e terraplenagem",
  RENOVATION: "Reforma e retrofit",
};
const sortOptions = [
  { value: "aderencia", label: "Maior aderência" },
  { value: "prazo", label: "Prazo mais curto" },
  { value: "valor", label: "Maior valor" },
  { value: "recente", label: "Captada mais recentemente" },
];

type Filters = Record<string, string | string[] | undefined>;
const many = (value: string | string[] | undefined): string[] => (Array.isArray(value) ? value : value ? [value] : []);
const one = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);
const digits = (value: string | undefined): number | undefined => {
  const parsed = Number((value ?? "").replace(/\D/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const currency = (value: Prisma.Decimal | null, undisclosed: boolean) =>
  undisclosed || value === null ? null : Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * O Prisma usa `null` para ausência; o domínio da aderência usa `undefined`.
 * A conversão fica aqui, na fronteira, para o domínio não precisar conhecer a
 * convenção do banco.
 */
type AdherenceRow = Readonly<{
  subject: string;
  sphere: string;
  workTypes: readonly string[];
  estimatedValue: Prisma.Decimal | null;
  valueUndisclosed: boolean;
  proposalClosesAt: Date | null;
}>;

const toAdherenceInput = (row: AdherenceRow): AdherenceInput => ({
  subject: row.subject,
  sphere: row.sphere,
  workTypes: row.workTypes,
  estimatedValue: row.estimatedValue === null ? undefined : Number(row.estimatedValue),
  valueUndisclosed: row.valueUndisclosed,
  proposalClosesAt: row.proposalClosesAt ?? undefined,
});

async function loadFilter(): Promise<ScoutFilter> {
  // O perfil salvo manda; o padrão só cobre a base que nunca foi configurada.
  return (await new PrismaScoutRepository().loadFilter()) ?? defaultScoutFilter;
}

export default async function ScoutedTendersPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorize(authorization, { permission: "opportunities.read" }).allowed) {
    return <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-10"><section className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-8"><p className="text-xs font-bold uppercase tracking-wider text-amber-800">Controle de acesso</p><h1 className="mt-2 text-2xl font-black text-amber-950">Acesso aguardando provisionamento</h1><p className="mt-3 leading-7 text-amber-900">Nenhum perfil aprovado concede consulta às licitações rastreadas.</p></section></main>;
  }

  const params = await searchParams;
  const query = one(params.q)?.trim().slice(0, 120);
  const selectedRegions = many(params.reg).filter((entry) => regions.includes(entry as never));
  const selectedTypes = many(params.tipo).filter((entry) => scoutWorkTypes.includes(entry as ScoutWorkType));
  const selectedSpheres = many(params.esfera).filter((entry) => entry in sphereLabels);
  const minimumValue = digits(one(params.vmin));
  const adherenceFloor = Math.max(0, Math.min(100, Number(one(params.ader) ?? 0) || 0));
  const sort = one(params.sort) ?? "aderencia";

  /**
   * Busca por texto e faixa de valor produzem, cada uma, um grupo OR. Escritas
   * como dois espalhamentos condicionais no mesmo objeto, a segunda apagava a
   * primeira em silêncio: quem buscasse texto E valor mínimo perdia a busca sem
   * nenhum aviso. Reunidas em AND, as duas valem juntas.
   */
  const groupsOfOr: Prisma.ScoutedTenderWhereInput[] = [];
  if (query) groupsOfOr.push({ OR: [{ subject: { contains: query, mode: "insensitive" } }, { authorityName: { contains: query, mode: "insensitive" } }, { city: { contains: query, mode: "insensitive" } }] });
  // Valor sigiloso nunca é excluído por faixa: o orçamento fechado é comum em
  // obra grande, e filtrá-lo por valor eliminaria justamente o alvo.
  if (minimumValue !== undefined) groupsOfOr.push({ OR: [{ estimatedValue: { gte: minimumValue } }, { valueUndisclosed: true }] });

  const states = statesOfRegions(selectedRegions);
  const where: Prisma.ScoutedTenderWhereInput = {
    status: "PENDING",
    ...(states.length > 0 && { state: { in: [...states] } }),
    ...(selectedTypes.length > 0 && { workTypes: { hasSome: selectedTypes } }),
    ...(selectedSpheres.length > 0 && { sphere: { in: selectedSpheres } }),
    ...(groupsOfOr.length > 0 && { AND: groupsOfOr }),
  };

  const orderBy: Prisma.ScoutedTenderOrderByWithRelationInput[] =
    sort === "valor" ? [{ estimatedValue: "desc" }, { proposalClosesAt: "asc" }]
    : sort === "recente" ? [{ createdAt: "desc" }]
    : [{ proposalClosesAt: "asc" }, { createdAt: "desc" }];

  const database = getDatabase();
  const now = new Date();
  const shortDeadline = new Date(now.getTime() + SHORT_DEADLINE_DAYS * 86_400_000);
  const filter = await loadFilter();

  const [rows, lastRun, facets, archive] = await Promise.all([
    database.scoutedTender.findMany({ where, orderBy, take: QUEUE_CAP, include: { signal: true } }),
    database.scoutRun.findFirst({ where: { status: "COMPLETED" }, orderBy: { startedAt: "desc" } }),
    // Projeção leve da fila inteira: alimenta os contadores dos cartões e das
    // opções de filtro sem trazer o registro completo.
    database.scoutedTender.findMany({
      where: { status: "PENDING" },
      select: { subject: true, state: true, sphere: true, workTypes: true, estimatedValue: true, valueUndisclosed: true, proposalClosesAt: true, runId: true },
    }),
    // O acervo é da empresa, não da licitação: uma consulta serve a fila
    // inteira. Buscar por linha faria centenas de idas ao banco por página.
    new PrismaArchiveEvidenceRepository().loadValidatedEvidence(),
  ]);

  const scored = rows.map((tender) => ({
    ...tender,
    // Os dois tons saem da cor gravada a cada leitura: a troca de tema não
    // consulta nada, e melhorias na regra de contraste valem para o que já
    // está no banco sem reescrever registro nenhum.
    signal: tender.signal ? { ...tender.signal, ...themeVariants(tender.signal.color) } : null,
    adherence: computeAdherence(toAdherenceInput(tender), filter, now),
    // A pergunta que inabilita: temos acervo para isto? Enquanto o edital não
    // for lido, o requisito é inferido do objeto — e sai marcado como tal.
    archive: computeArchiveAdherence(
      {
        workTypes: resolveWorkTypes(toAdherenceInput(tender)),
        ...(tender.valueUndisclosed || tender.estimatedValue === null ? {} : { estimatedValue: Number(tender.estimatedValue) }),
        inferred: true,
      },
      archive,
    ),
    days: tender.proposalClosesAt ? Math.max(0, Math.ceil((tender.proposalClosesAt.getTime() - now.getTime()) / 86_400_000)) : undefined,
  }));

  /**
   * O corte é pelo ACERVO, que é o critério que inabilita. Licitação cujo
   * acervo não pôde ser julgado — sem tipo reconhecido ou sem nada cadastrado —
   * fica de fora do corte em vez de virar zero, e o cabeçalho diz quantas
   * foram postas de lado. Esconder em silêncio o que não foi medido faria a
   * equipe perder obra que ela sabe fazer.
   */
  const semJulgamento = adherenceFloor > 0 ? scored.filter((tender) => !tender.archive.determined).length : 0;
  const kept = adherenceFloor > 0
    ? scored.filter((tender) => tender.archive.determined && tender.archive.score >= adherenceFloor)
    : scored;
  const ordered = sort === "aderencia"
    // Sem acervo julgado, o perfil serve de desempate: é o que sobra para
    // ordenar, e vale mais que ordem aleatória.
    ? [...kept].sort((a, b) => (b.archive.determined ? b.archive.score : -1) - (a.archive.determined ? a.archive.score : -1)
        || b.adherence.score - a.adherence.score)
    : kept;
  const tenders = ordered.slice(0, PAGE_SIZE);

  const facetScores = facets.map((entry) => computeAdherence(toAdherenceInput(entry), filter, now));
  const total = facets.length;
  const offProfile = facetScores.filter((entry) => entry.score < OFF_PROFILE).length;

  const groups: FilterGroup[] = [
    { key: "reg", label: "Região", options: regions.map((region) => ({ value: region, label: region, count: facets.filter((entry) => regionOf(entry.state) === region).length })) },
    { key: "tipo", label: "Tipo de obra", options: scoutWorkTypes.map((type) => ({ value: type, label: workTypeLabels[type], count: facetScores.filter((entry) => entry.workTypes.includes(type)).length })) },
    { key: "esfera", label: "Esfera", options: Object.entries(sphereLabels).map(([value, label]) => ({ value, label, count: facets.filter((entry) => entry.sphere === value).length })) },
  ];

  const canDecide = authorize(authorization, { permission: "opportunities.create" }).allowed;
  const truncated = rows.length === QUEUE_CAP;

  return <div className="bx" id={THEME_ROOT_ID}>
    {/* Aplica o tema salvo antes da pintura, para a tela não piscar no claro
        antes de virar escura. */}
    <script dangerouslySetInnerHTML={{ __html: themeBootScript }}/>

    <div className="mx-auto w-full max-w-[1560px] px-4 py-6 sm:px-6 lg:px-8">
    <Link className="bx-voltar" href="/opportunities">← Voltar às oportunidades</Link>

    <header className="bx-topo" style={{ marginTop: 10 }}>
      <div>
        <p className="bx-sobrenome">Buscador G-SIPRO</p>
        <h1 className="bx-titulo">Oportunidades rastreadas</h1>
        <p className="bx-sub">Captadas na varredura de domingo. Aprovar cadastra a oportunidade automaticamente; descartar guarda no histórico.</p>
      </div>
      <ThemeToggle/>
    </header>

    <section aria-label="Resumo da fila" className="bx-cartoes">
      <Cartao dica="aguardando decisão" rotulo="Na fila" valor={total}/>
      <Cartao dica={lastRun ? `varredura de ${lastRun.startedAt.toLocaleDateString("pt-BR")}` : "nenhuma varredura concluída"} rotulo="Novas nesta semana" valor={lastRun ? facets.filter((entry) => entry.runId === lastRun.id).length : 0}/>
      <Cartao destaque dica={`aderência abaixo de ${OFF_PROFILE}%`} rotulo="Fora do perfil" valor={offProfile}/>
      <Cartao dica={`encerram em até ${SHORT_DEADLINE_DAYS} dias`} rotulo="Prazo curto" valor={facets.filter((entry) => entry.proposalClosesAt && entry.proposalClosesAt <= shortDeadline).length}/>
      <Cartao dica="orçamento fechado pelo órgão" rotulo="Valor sigiloso" valor={facets.filter((entry) => entry.valueUndisclosed).length}/>
    </section>

    <section className="bx-mesa" style={{ marginTop: 14 }}>
      <ScoutedFilters groups={groups} sortOptions={sortOptions}/>

      <header className="bx-relacao">
        <h2>
          Relação de rastreadas
          <span className="total">{kept.length === total ? total : `${kept.length} de ${total}`}</span>
        </h2>
        <p>
          {kept.length > tenders.length && <>Mostrando as <strong>{tenders.length}</strong> primeiras · </>}
          {semJulgamento > 0 && <><strong>{semJulgamento}</strong> fora do corte por acervo não julgado · </>}
          {truncated && <>Fila maior que {QUEUE_CAP}; a contagem por aderência considera as {QUEUE_CAP} primeiras · </>}
          Ordenado por <strong>{sortOptions.find((option) => option.value === sort)?.label.toLowerCase()}</strong>
        </p>
      </header>

      <div>
        {tenders.map((tender) => {
          const value = currency(tender.estimatedValue, tender.valueUndisclosed);
          const days = tender.days;
          const signal = tender.signal;
          return <details
            className="bx-linha"
            data-sinalizada={signal ? "sim" : undefined}
            key={tender.id}
            style={signal ? ({ "--sig-claro": signal.light, "--sig-escuro": signal.dark } as CSSProperties) : undefined}
          >
            <summary className="bx-cab">
              {/* Faixa e bandeira ficam DENTRO do summary: soltas no details o
                  navegador as trata como conteúdo do detalhe e joga para o rodapé. */}
              {signal && <><span className="bx-terreno"/><span className="bx-bandeira"><Flag/></span></>}
              <svg aria-hidden="true" className="bx-seta h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>

              <div className="min-w-0">
                <p className="bx-objeto">{tender.subject}</p>
                <p className="bx-orgao">{tender.authorityName} · {tender.modality} · {sphereLabels[tender.sphere] ?? tender.sphere}</p>
                <div className="bx-etiquetas">
                  {signal && <span className="bx-marca-p"><Flag size={13}/>{signal.label}</span>}
                  {tender.adherence.workTypes.map((type) => <span className="bx-eti tipo" key={type}>{workTypeLabels[type] ?? type}</span>)}
                  {tender.valueUndisclosed && <span className="bx-eti alerta">valor sigiloso</span>}
                  {tender.adherence.reasons.filter((reason) => !reason.met && !reason.skipped && reason.criterion !== "SPHERE").map((reason) =>
                    <span className="bx-eti alerta" key={reason.criterion}>{reason.label}</span>)}
                  {tender.archive.determined
                    ? <span className="bx-eti">acervo {tender.archive.score}%{tender.archive.requirementInferred ? " (estimado)" : ""}</span>
                    : <span className="bx-eti">acervo não julgado</span>}
                </div>
              </div>

              <div className="bx-num">
                <p className={value ? "bx-valor" : "bx-valor sigiloso"}>{value ?? "Sigiloso"}</p>
                <p className="bx-local">{tender.city ? `${tender.city} / ${tender.state ?? ""}` : tender.state ?? "—"}</p>
              </div>

              <div className="bx-num bx-prazo">
                {days === undefined ? <p className="bx-local">—</p> : <>
                  <p className={days <= SHORT_DEADLINE_DAYS ? "bx-dias curto" : "bx-dias"}>{days} dias</p>
                  <p className="bx-data">{tender.proposalClosesAt?.toLocaleDateString("pt-BR")}</p>
                </>}
              </div>

              <div className="bx-medidor-caixa">
                <AdherenceGauge score={tender.archive.score} undetermined={!tender.archive.determined}/>
                {canDecide ? <TriageActions id={tender.id}/> : <span className="bx-local block text-center">Sem alçada para decidir</span>}
                {/* Sinalizar orienta a equipe; não aprova nem descarta nada.
                    Por isso não depende da alçada de decidir. */}
                <div className="bx-mini-acoes">
                  <SignalActions id={tender.id} signal={signal ? { level: signal.level, label: signal.label, color: signal.color, ...(signal.note ? { note: signal.note } : {}) } : undefined}/>
                </div>
              </div>
            </summary>

            <div className="bx-painel">
              <dl className="bx-paineis">
                <div className="bx-bloco">
                  <h3>Identificação</h3>
                  <Linha rotulo="Órgão" valor={tender.authorityName}/>
                  <Linha rotulo="Esfera" valor={sphereLabels[tender.sphere] ?? tender.sphere}/>
                  <Linha rotulo="Modalidade" valor={tender.modality}/>
                  <Linha rotulo="Processo" valor={tender.processNumber ?? "—"}/>
                  <Linha rotulo="Localidade" valor={tender.city ? `${tender.city} / ${tender.state ?? ""}` : tender.state ?? "—"}/>
                </div>

                <div className="bx-bloco">
                  <h3>Prazos</h3>
                  <Linha rotulo="Abertura das propostas" valor={tender.proposalOpensAt?.toLocaleDateString("pt-BR") ?? "—"}/>
                  <Linha rotulo="Encerramento" valor={tender.proposalClosesAt?.toLocaleDateString("pt-BR") ?? "—"}/>
                  <Linha rotulo="Dias restantes" valor={days === undefined ? "—" : `${days} dias`}/>
                  <Linha rotulo="Captada em" valor={tender.createdAt.toLocaleDateString("pt-BR")}/>
                </div>

                <div className="bx-bloco">
                  <h3>Acervo técnico — {tender.archive.determined ? `${tender.archive.score}%` : "não julgado"}</h3>
                  {tender.archive.reasons.map((reason) => <Motivo key={reason} met={!/^sem acervo|^nenhum acervo|^tipo de obra n|maior obra executada/.test(reason)} rotulo={reason} skipped={/^porte não|^nenhum acervo|^tipo de obra n/.test(reason)}/>)}
                  {tender.archive.requirementInferred && <p className="bx-nota" style={{ borderTop: "1px solid var(--fio)" }}>
                    Requisito <strong>estimado a partir do objeto</strong>. As parcelas de maior relevância exigidas de fato só constam do edital, que ainda não é lido automaticamente.
                  </p>}
                </div>

                <div className="bx-bloco">
                  <h3>Aderência ao perfil — {tender.adherence.undetermined ? "não calculada" : `${tender.adherence.score}%`}</h3>
                  {tender.adherence.reasons.map((reason) => <Motivo key={reason.criterion} met={reason.met} rotulo={reason.label} skipped={reason.skipped}/>)}
                </div>

                {signal?.note && <div className="bx-bloco">
                  <h3>Sinalização — {signal.label}</h3>
                  <p className="bx-nota">{signal.note}</p>
                </div>}

                <div className="bx-bloco">
                  <h3>Habilitação técnica</h3>
                  <p className="bx-nota">
                    A aderência acima mede o <strong>perfil</strong> da empresa, não o acervo. Acervo exigido, consórcio, garantia de proposta e visita técnica só constam do edital, e passam a aparecer aqui quando a leitura automática entrar em operação.
                  </p>
                  {tender.noticeUrl && <a className="bx-link" href={tender.noticeUrl} rel="noreferrer" target="_blank">
                    Abrir o edital no PNCP
                    <svg aria-hidden="true" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-8 8"/></svg>
                  </a>}
                </div>
              </dl>
            </div>
          </details>;
        })}

        {tenders.length === 0 && <div className="bx-vazio">
          <p>{total === 0 ? "Nenhuma licitação aguardando triagem" : "Nada com esses filtros"}</p>
          <span>{total === 0 ? "A próxima varredura ocorre no domingo." : "Baixe a aderência mínima ou desmarque alguma região."}</span>
        </div>}
      </div>
    </section>
    </div>
  </div>;
}

function Cartao({ rotulo, valor, dica, destaque }: { rotulo: string; valor: number; dica: string; destaque?: boolean }) {
  return <article className={destaque && valor > 0 ? "bx-cartao destaque" : "bx-cartao"}>
    <p className="rot">{rotulo}</p>
    <p className="num">{valor}</p>
    <p className="dica">{dica}</p>
  </article>;
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div className="bx-item"><dt>{rotulo}</dt><dd>{valor}</dd></div>;
}

const tick = <svg aria-hidden="true" className="marca" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="m5 13 4 4L19 7"/></svg>;
const cross = <svg aria-hidden="true" className="marca" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>;
const dash = <svg aria-hidden="true" className="marca" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24"><path d="M6 12h12"/></svg>;

function Motivo({ rotulo, met, skipped }: { rotulo: string; met: boolean; skipped: boolean }) {
  const estado = skipped ? "pulado" : met ? "atende" : "falha";
  return <div className={`bx-motivo ${estado}`}>
    {skipped ? dash : met ? tick : cross}
    <span>{rotulo}</span>
  </div>;
}
