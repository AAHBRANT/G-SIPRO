import Link from "next/link";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { GsIcon } from "@/components/ui/gs-icon";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import { opportunityStatuses, type OpportunityStatus } from "@/modules/opportunities/domain/opportunity";
import { CreateOpportunityForm } from "./create-opportunity-form";

type Filters = { status?: string; query?: string; ownerId?: string; customerId?: string; deliveryFrom?: string; deliveryTo?: string; minValue?: string; maxValue?: string; page?: string; pageSize?: string };
const statusLabels: Record<OpportunityStatus, string> = { DRAFT: "Rascunho", QUALIFICATION: "Qualificação", ACTIVE: "Ativa", SUSPENDED: "Suspensa", CLOSED: "Encerrada" };
const statusTone: Record<OpportunityStatus, string> = { DRAFT: "bg-slate-100 text-slate-600", QUALIFICATION: "bg-violet-50 text-violet-700", ACTIVE: "bg-emerald-50 text-emerald-700", SUSPENDED: "bg-amber-50 text-amber-700", CLOSED: "bg-slate-200 text-slate-700" };
const currency = (value: Prisma.Decimal | null, code: string | null) => value === null ? "—" : Number(value).toLocaleString("pt-BR", { style: "currency", currency: code ?? "BRL", maximumFractionDigits: 0 });

function pageHref(filters: Filters, page: number, pageSize: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value && key !== "page" && key !== "pageSize") params.set(key, value);
  params.set("page", String(page)); params.set("pageSize", String(pageSize));
  return `/opportunities?${params.toString()}`;
}

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorize(authorization, { permission: "opportunities.read" }).allowed) return <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-10"><section className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-8"><p className="text-xs font-bold uppercase tracking-wider text-amber-800">Controle de acesso</p><h1 className="mt-2 text-2xl font-black text-amber-950">Acesso aguardando provisionamento</h1><p className="mt-3 leading-7 text-amber-900">Sua identidade foi reconhecida, mas nenhum perfil aprovado concede consulta às oportunidades. Solicite ao administrador a atribuição formal do perfil adequado.</p></section></main>;

  const filters = await searchParams;
  const status = opportunityStatuses.includes(filters.status as OpportunityStatus) ? filters.status as OpportunityStatus : undefined;
  const query = filters.query?.trim().slice(0, 100);
  const ownerId = z.uuid().safeParse(filters.ownerId).success ? filters.ownerId : undefined;
  const customerId = z.uuid().safeParse(filters.customerId).success ? filters.customerId : undefined;
  const deliveryFrom = filters.deliveryFrom ? new Date(`${filters.deliveryFrom}T00:00:00`) : undefined;
  const deliveryTo = filters.deliveryTo ? new Date(`${filters.deliveryTo}T23:59:59.999`) : undefined;
  const minValue = filters.minValue && Number.isFinite(Number(filters.minValue)) ? Number(filters.minValue) : undefined;
  const maxValue = filters.maxValue && Number.isFinite(Number(filters.maxValue)) ? Number(filters.maxValue) : undefined;
  const pageSize = [10, 25, 50, 100].includes(Number(filters.pageSize)) ? Number(filters.pageSize) : 10;
  const page = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);
  const where: Prisma.OpportunityWhereInput = {
    ...(status && { status }), ...(ownerId && { ownerId }), ...(customerId && { customerId }),
    ...((deliveryFrom || deliveryTo) && { deliveryAt: { ...(deliveryFrom && { gte: deliveryFrom }), ...(deliveryTo && { lte: deliveryTo }) } }),
    ...((minValue !== undefined || maxValue !== undefined) && { estimatedValue: { ...(minValue !== undefined && { gte: minValue }), ...(maxValue !== undefined && { lte: maxValue }) } }),
    ...(query && { OR: [{ code: { contains: query, mode: "insensitive" } }, { subject: { contains: query, mode: "insensitive" } }, { customer: { name: { contains: query, mode: "insensitive" } } }, { contractingAuthority: { name: { contains: query, mode: "insensitive" } } }] }),
  };
  const database = getDatabase();
  const now = new Date(); const nextThirtyDays = new Date(now.getTime() + 30 * 86400000);
  const [opportunities, totalFiltered, owners, customers, total, active, qualification, upcoming, closed] = await Promise.all([
    database.opportunity.findMany({ where, include: { customer: true, contractingAuthority: true, owner: true }, orderBy: [{ deliveryAt: "asc" }, { createdAt: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    database.opportunity.count({ where }),
    database.user.findMany({ where: { status: "ACTIVE" }, orderBy: { displayName: "asc" } }),
    database.customer.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    database.opportunity.count(), database.opportunity.count({ where: { status: "ACTIVE" } }), database.opportunity.count({ where: { status: "QUALIFICATION" } }),
    database.opportunity.count({ where: { status: { not: "CLOSED" }, deliveryAt: { gte: now, lte: nextThirtyDays } } }), database.opportunity.count({ where: { status: "CLOSED" } }),
  ]);
  const canCreate = authorize(authorization, { permission: "opportunities.create" }).allowed;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize)); const safePage = Math.min(page, totalPages);
  const firstRecord = totalFiltered ? (safePage - 1) * pageSize + 1 : 0; const lastRecord = Math.min(safePage * pageSize, totalFiltered);

  return <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <PageHeader action={canCreate ? <CreateOpportunityForm/> : undefined} eyebrow="Comercial" icon="target" subtitle="Registre sinais de mercado e acompanhe sua evolução até a decisão comercial." title="Oportunidades"/>

    <section aria-label="Indicadores de oportunidades" className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard description="Todas as oportunidades registradas" icon="target" title="Total de oportunidades" tone="blue" value={total}/>
      <MetricCard description="Oportunidades atualmente em acompanhamento" icon="chart" title="Oportunidades ativas" tone="green" value={active}/>
      <MetricCard description="Registros aguardando análise comercial" icon="clock" title="Em qualificação" tone="violet" value={qualification}/>
      <MetricCard description="Prazos previstos para os próximos 30 dias" icon="calendar" title="Prazos próximos" tone="amber" value={upcoming}/>
      <MetricCard description="Oportunidades encerradas com histórico preservado" icon="file" title="Encerradas" tone="slate" value={closed}/>
    </section>

    <Panel className="mt-6" subtitle="Pesquise, filtre e consulte todas as oportunidades cadastradas" title="Relação de oportunidades">
      <form className="grid gap-3 border-b border-slate-200 bg-slate-50/70 p-4 md:grid-cols-2 xl:grid-cols-4" method="get">
        <label className="grid gap-1 text-xs font-bold text-slate-600">Código, objeto ou cliente<input className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal" name="query" defaultValue={query}/></label>
        <label className="grid gap-1 text-xs font-bold text-slate-600">Situação<select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal" name="status" defaultValue={status ?? ""}><option value="">Todas</option>{opportunityStatuses.map((entry) => <option key={entry} value={entry}>{statusLabels[entry]}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-bold text-slate-600">Responsável<select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal" name="ownerId" defaultValue={ownerId ?? ""}><option value="">Todos</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.displayName}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-bold text-slate-600">Cliente<select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal" name="customerId" defaultValue={customerId ?? ""}><option value="">Todos</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-bold text-slate-600">Prazo inicial<input className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal" name="deliveryFrom" type="date" defaultValue={filters.deliveryFrom}/></label>
        <label className="grid gap-1 text-xs font-bold text-slate-600">Prazo final<input className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal" name="deliveryTo" type="date" defaultValue={filters.deliveryTo}/></label>
        <label className="grid gap-1 text-xs font-bold text-slate-600">Valor mínimo<input className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal" name="minValue" type="number" min="0" step="0.01" defaultValue={filters.minValue}/></label>
        <label className="grid gap-1 text-xs font-bold text-slate-600">Valor máximo<input className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal" name="maxValue" type="number" min="0" step="0.01" defaultValue={filters.maxValue}/></label>
        <input name="pageSize" type="hidden" value={pageSize}/><div className="flex flex-wrap justify-end gap-2 md:col-span-2 xl:col-span-4"><Link className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600" href="/opportunities">Limpar filtros</Link><button className="inline-flex h-10 items-center rounded-lg bg-brand px-5 text-xs font-bold text-white">Aplicar filtros</button></div>
      </form>

      <div className="overflow-x-auto"><table className="w-full min-w-[1050px] table-fixed text-left text-sm"><colgroup><col className="w-[13%]"/><col className="w-[25%]"/><col className="w-[16%]"/><col className="w-[14%]"/><col className="w-[11%]"/><col className="w-[10%]"/><col className="w-[8%]"/><col className="w-[6%]"/></colgroup><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Código</th><th className="px-4 py-3">Objeto</th><th className="px-4 py-3">Cliente/órgão</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3">Prazo</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Status</th><th className="px-3 py-3 text-center">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{opportunities.map((entry) => <tr className="h-16 transition hover:bg-blue-50/30" key={entry.id}><td className="px-4 py-3"><Link className="block truncate font-bold text-brand hover:underline" href={`/opportunities/${entry.id}`}>{entry.code}</Link></td><td className="px-4 py-3"><span className="block truncate text-slate-700" title={entry.subject ?? ""}>{entry.subject ?? "—"}</span></td><td className="px-4 py-3"><span className="block truncate text-slate-600">{entry.customer?.name ?? entry.contractingAuthority?.name ?? "—"}</span></td><td className="px-4 py-3"><span className="block truncate text-slate-600">{entry.owner?.displayName ?? "Não atribuído"}</span></td><td className="whitespace-nowrap px-4 py-3 text-slate-600">{entry.deliveryAt ? entry.deliveryAt.toLocaleDateString("pt-BR") : "—"}</td><td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">{currency(entry.estimatedValue, entry.currency)}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone[entry.status]}`}>{statusLabels[entry.status]}</span></td><td className="px-3 py-3 text-center"><Link aria-label={`Visualizar ${entry.code}`} className="inline-grid h-8 w-8 place-items-center rounded-lg text-brand hover:bg-blue-50" href={`/opportunities/${entry.id}`} title="Visualizar"><GsIcon className="h-4 w-4" name="eye"/></Link></td></tr>)}{opportunities.length === 0 && <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={8}>Nenhuma oportunidade encontrada.</td></tr>}</tbody></table></div>

      <footer className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center"><span>Mostrando {firstRecord} a {lastRecord} de {totalFiltered} oportunidades</span><div className="ml-auto flex items-center gap-2"><span>Por página:</span><div className="flex gap-1">{[10, 25, 50, 100].map((size) => <Link className={`grid h-8 min-w-8 place-items-center rounded-lg border px-2 font-bold ${pageSize === size ? "border-brand bg-blue-50 text-brand" : "border-slate-200 bg-white"}`} href={pageHref(filters, 1, size)} key={size}>{size}</Link>)}</div><Link aria-disabled={safePage <= 1} className={`rounded-lg border border-slate-200 px-3 py-2 font-bold ${safePage <= 1 ? "pointer-events-none opacity-40" : ""}`} href={pageHref(filters, safePage - 1, pageSize)}>Anterior</Link><span className="font-bold text-slate-700">{safePage}/{totalPages}</span><Link aria-disabled={safePage >= totalPages} className={`rounded-lg border border-slate-200 px-3 py-2 font-bold ${safePage >= totalPages ? "pointer-events-none opacity-40" : ""}`} href={pageHref(filters, safePage + 1, pageSize)}>Próximo</Link></div></footer>
    </Panel>
  </main>;
}
