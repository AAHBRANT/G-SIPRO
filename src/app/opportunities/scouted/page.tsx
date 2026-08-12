import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { regionOf, regions, statesOfRegions } from "@/modules/scouting/domain/regions";
import { scoutWorkTypes, type ScoutWorkType } from "@/modules/scouting/domain/scout-filter";
import { ScoutedFilters, type FilterGroup } from "./scouted-filters";
import { TriageActions } from "./triage-actions";

const PAGE_SIZE = 60;
const SHORT_DEADLINE_DAYS = 14;

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
 * Busca a fila e já resolve o que depende do relógio — dias restantes, prazo
 * curto — fora da renderização, que deve permanecer pura.
 */
async function loadQueue(where: Prisma.ScoutedTenderWhereInput, orderBy: Prisma.ScoutedTenderOrderByWithRelationInput[]) {
  const database = getDatabase();
  const now = Date.now();
  const shortDeadline = new Date(now + SHORT_DEADLINE_DAYS * 86_400_000);
  const [page, filtered, lastRun, facets] = await Promise.all([
    database.scoutedTender.findMany({ where, orderBy, take: PAGE_SIZE }),
    database.scoutedTender.count({ where }),
    database.scoutRun.findFirst({ where: { status: "COMPLETED" }, orderBy: { startedAt: "desc" } }),
    // Projeção leve da fila inteira: alimenta os contadores dos cartões e das
    // opções de filtro sem trazer o texto dos objetos.
    database.scoutedTender.findMany({ where: { status: "PENDING" }, select: { state: true, sphere: true, workTypes: true, valueUndisclosed: true, proposalClosesAt: true, runId: true } }),
  ]);

  return {
    filtered, lastRun, facets,
    total: facets.length,
    fromLastRun: lastRun ? facets.filter((entry) => entry.runId === lastRun.id).length : 0,
    urgent: facets.filter((entry) => entry.proposalClosesAt && entry.proposalClosesAt <= shortDeadline).length,
    undisclosed: facets.filter((entry) => entry.valueUndisclosed).length,
    tenders: page.map((tender) => ({
      ...tender,
      days: tender.proposalClosesAt ? Math.max(0, Math.ceil((tender.proposalClosesAt.getTime() - now) / 86_400_000)) : undefined,
    })),
  };
}

export default async function ScoutedTendersPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorize(authorization, { permission: "opportunities.read" }).allowed) {
    return <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-10"><section className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-8"><p className="text-xs font-bold uppercase tracking-wider text-amber-800">Controle de acesso</p><h1 className="mt-2 text-2xl font-black text-amber-950">Acesso aguardando provisionamento</h1><p className="mt-3 leading-7 text-amber-900">Nenhum perfil aprovado concede consulta às licitações rastreadas.</p></section></main>;
  }

  const filters = await searchParams;
  const query = one(filters.q)?.trim().slice(0, 120);
  const selectedRegions = many(filters.reg).filter((entry) => regions.includes(entry as never));
  const selectedTypes = many(filters.tipo).filter((entry) => scoutWorkTypes.includes(entry as ScoutWorkType));
  const selectedSpheres = many(filters.esfera).filter((entry) => entry in sphereLabels);
  const minimumValue = digits(one(filters.vmin));
  const sort = one(filters.sort) ?? "prazo";

  const states = statesOfRegions(selectedRegions);
  const where: Prisma.ScoutedTenderWhereInput = {
    status: "PENDING",
    ...(query && { OR: [{ subject: { contains: query, mode: "insensitive" } }, { authorityName: { contains: query, mode: "insensitive" } }, { city: { contains: query, mode: "insensitive" } }] }),
    ...(states.length > 0 && { state: { in: [...states] } }),
    ...(selectedTypes.length > 0 && { workTypes: { hasSome: selectedTypes } }),
    ...(selectedSpheres.length > 0 && { sphere: { in: selectedSpheres } }),
    // Valor sigiloso nunca é excluído por faixa: o orçamento fechado é comum em
    // obra grande, e filtrá-lo por valor eliminaria justamente o alvo.
    ...(minimumValue !== undefined && { OR: [{ estimatedValue: { gte: minimumValue } }, { valueUndisclosed: true }] }),
  };

  const orderBy: Prisma.ScoutedTenderOrderByWithRelationInput[] =
    sort === "valor" ? [{ estimatedValue: "desc" }, { proposalClosesAt: "asc" }]
    : sort === "recente" ? [{ createdAt: "desc" }]
    : [{ proposalClosesAt: "asc" }, { createdAt: "desc" }];

  const { tenders, filtered, lastRun, facets, total, fromLastRun, urgent, undisclosed } = await loadQueue(where, orderBy);

  const groups: FilterGroup[] = [
    { key: "reg", label: "Região", options: regions.map((region) => ({ value: region, label: region, count: facets.filter((entry) => regionOf(entry.state) === region).length })) },
    { key: "tipo", label: "Tipo de obra", options: scoutWorkTypes.map((type) => ({ value: type, label: workTypeLabels[type], count: facets.filter((entry) => entry.workTypes.includes(type)).length })) },
    { key: "esfera", label: "Esfera", options: Object.entries(sphereLabels).map(([value, label]) => ({ value, label, count: facets.filter((entry) => entry.sphere === value).length })) },
  ];

  const canDecide = authorize(authorization, { permission: "opportunities.create" }).allowed;

  return <main className="mx-auto w-full max-w-[1560px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
    <Link className="text-sm font-bold text-brand hover:underline" href="/opportunities">← Voltar às oportunidades</Link>
    <div className="mt-3">
      <PageHeader eyebrow="Buscador G-SIPRO" icon="search" subtitle="Captadas na varredura de domingo. Aprovar cadastra a oportunidade automaticamente; descartar guarda no histórico." title="Oportunidades rastreadas" variant="executive"/>
    </div>

    <section aria-label="Resumo da fila" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard hint="aguardando decisão" label="Na fila" tone="slate" value={total}/>
      <SummaryCard hint={lastRun ? `varredura de ${lastRun.startedAt.toLocaleDateString("pt-BR")}` : "nenhuma varredura concluída"} label="Novas nesta semana" tone="blue" value={fromLastRun}/>
      <SummaryCard hint={`encerram em até ${SHORT_DEADLINE_DAYS} dias`} label="Prazo curto" tone="brand" value={urgent}/>
      <SummaryCard hint="orçamento fechado pelo órgão" label="Valor sigiloso" tone="amber" value={undisclosed}/>
    </section>

    <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_3px_12px_rgba(15,23,42,0.05)]">
      <ScoutedFilters groups={groups} sortOptions={sortOptions}/>

      <header className="flex flex-wrap items-center justify-between gap-3 bg-slate-800 px-4 py-3 text-white">
        <h2 className="flex items-center gap-2.5 text-xs font-black uppercase tracking-wider">
          Relação de rastreadas
          <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] tabular-nums">{filtered === total ? total : `${filtered} de ${total}`}</span>
        </h2>
        <p className="text-[11px] text-slate-300">
          {filtered > tenders.length && <>Mostrando as <strong className="text-white">{tenders.length}</strong> primeiras · </>}
          Ordenado por <strong className="text-white">{sortOptions.find((option) => option.value === sort)?.label.toLowerCase()}</strong>
        </p>
      </header>

      <div className="divide-y divide-slate-100">
        {tenders.map((tender) => {
          const days = tender.days;
          const value = currency(tender.estimatedValue, tender.valueUndisclosed);
          return <details className="group" key={tender.id}>
            <summary className="grid cursor-pointer list-none grid-cols-[18px_minmax(0,1fr)_130px_92px_150px] items-start gap-3 px-4 py-3.5 transition hover:bg-slate-50/70 group-open:bg-slate-50">
              <svg aria-hidden="true" className="mt-1 h-3.5 w-3.5 text-slate-400 transition group-open:rotate-90 group-open:text-brand" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>
              <div className="min-w-0">
                <p className="text-[14.5px] font-semibold leading-snug text-slate-900">{tender.subject}</p>
                <p className="mt-1 text-xs text-slate-500">{tender.authorityName} · {tender.modality} · {sphereLabels[tender.sphere] ?? tender.sphere}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tender.workTypes.map((type) => <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10.5px] font-semibold text-indigo-900" key={type}>{workTypeLabels[type as ScoutWorkType] ?? type}</span>)}
                  {tender.valueUndisclosed && <span className="rounded bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-900">valor sigiloso</span>}
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-500">acervo não verificado</span>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-[15px] font-bold tabular-nums ${value ? "text-slate-900" : "text-amber-800"}`}>{value ?? "Sigiloso"}</p>
                <p className="mt-1 text-xs text-slate-500">{tender.city ? `${tender.city} / ${tender.state ?? ""}` : tender.state ?? "—"}</p>
              </div>
              <div className="text-right">
                {days === undefined ? <p className="text-slate-500">—</p> : <>
                  <p className={`text-[15px] font-bold tabular-nums ${days <= SHORT_DEADLINE_DAYS ? "text-brand" : "text-slate-700"}`}>{days} dias</p>
                  <p className="mt-1 text-[10.5px] tabular-nums text-slate-400">{tender.proposalClosesAt?.toLocaleDateString("pt-BR")}</p>
                </>}
              </div>
              <div onClick={(event) => event.preventDefault()}>
                {canDecide ? <TriageActions id={tender.id}/> : <span className="block text-center text-[10px] text-slate-400">Sem alçada para decidir</span>}
              </div>
            </summary>

            <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 pl-11">
              <dl className="grid gap-3 md:grid-cols-3">
                <Panel title="Identificação">
                  <Row label="Órgão" value={tender.authorityName}/>
                  <Row label="Esfera" value={sphereLabels[tender.sphere] ?? tender.sphere}/>
                  <Row label="Modalidade" value={tender.modality}/>
                  <Row label="Processo" value={tender.processNumber ?? "—"}/>
                  <Row label="Localidade" value={tender.city ? `${tender.city} / ${tender.state ?? ""}` : tender.state ?? "—"}/>
                </Panel>
                <Panel title="Prazos">
                  <Row label="Abertura das propostas" value={tender.proposalOpensAt?.toLocaleDateString("pt-BR") ?? "—"}/>
                  <Row label="Encerramento" value={tender.proposalClosesAt?.toLocaleDateString("pt-BR") ?? "—"}/>
                  <Row label="Dias restantes" value={days === undefined ? "—" : `${days} dias`}/>
                  <Row label="Captada em" value={tender.createdAt.toLocaleDateString("pt-BR")}/>
                </Panel>
                <Panel title="Habilitação técnica">
                  <p className="px-3 py-3 text-xs leading-5 text-slate-500">
                    O edital ainda não foi analisado. Acervo exigido, consórcio, garantia de proposta e visita técnica passam a aparecer aqui quando a leitura automática do edital entrar em operação.
                  </p>
                  {tender.noticeUrl && <a className="mx-3 mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline" href={tender.noticeUrl} rel="noreferrer" target="_blank">
                    Abrir o edital no PNCP
                    <svg aria-hidden="true" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-8 8"/></svg>
                  </a>}
                </Panel>
              </dl>
            </div>
          </details>;
        })}

        {tenders.length === 0 && <div className="px-4 py-14 text-center">
          <p className="text-sm font-bold text-slate-700">{total === 0 ? "Nenhuma licitação aguardando triagem" : "Nada com esses filtros"}</p>
          <p className="mt-1.5 text-[13px] text-slate-500">{total === 0 ? "A próxima varredura ocorre no domingo." : "Desmarque alguma região ou tipo de obra para ver mais."}</p>
        </div>}
      </div>
    </section>
  </main>;
}

const tones: Record<string, string> = {
  slate: "border-slate-200 bg-slate-50 text-slate-700",
  blue: "border-blue-100 bg-blue-50/70 text-blue-800",
  brand: "border-red-100 bg-red-50/70 text-[color:var(--brand)]",
  amber: "border-amber-100 bg-amber-50/70 text-amber-800",
};

function SummaryCard({ label, value, hint, tone }: { label: string; value: number; hint: string; tone: keyof typeof tones }) {
  return <article className={`rounded-xl border p-4 ${tones[tone]}`}>
    <p className="text-xs font-bold">{label}</p>
    <p className="mt-1.5 text-[30px] font-black leading-none tracking-tight tabular-nums">{value}</p>
    <p className="mt-2 text-[11px] text-slate-500">{hint}</p>
  </article>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
    <h3 className="border-b border-slate-100 bg-slate-50/60 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500">{title}</h3>
    {children}
  </div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3 border-b border-slate-100 px-3 py-1.5 text-xs last:border-b-0">
    <dt className="text-slate-500">{label}</dt>
    <dd className="text-right font-semibold text-slate-800">{value}</dd>
  </div>;
}
