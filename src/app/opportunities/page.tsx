import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { GsIcon } from "@/components/ui/gs-icon";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import type { OpportunityStatus } from "@/modules/opportunities/domain/opportunity";
import { CreateOpportunityForm } from "./create-opportunity-form";
import { OpportunityPageSizeSelect, OpportunityTableControls } from "./opportunity-table-controls";

type Filters = { query?: string; status?: string; page?: string; pageSize?: string };
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
  const query = filters.query?.trim().slice(0, 100);
  const status = (["DRAFT", "QUALIFICATION", "ACTIVE", "SUSPENDED", "CLOSED"] as OpportunityStatus[]).includes(filters.status as OpportunityStatus) ? filters.status as OpportunityStatus : undefined;
  const pageSize = [10, 25, 50, 100].includes(Number(filters.pageSize)) ? Number(filters.pageSize) : 10;
  const page = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);
  const where: Prisma.OpportunityWhereInput = {
    ...(status && { status }),
    ...(query && { OR: [{ code: { contains: query, mode: "insensitive" } }, { subject: { contains: query, mode: "insensitive" } }, { customer: { name: { contains: query, mode: "insensitive" } } }, { contractingAuthority: { name: { contains: query, mode: "insensitive" } } }] }),
  };
  const database = getDatabase();
  const now = new Date(); const nextThirtyDays = new Date(now.getTime() + 30 * 86400000);
  const [opportunities, totalFiltered, total, active, qualification, upcoming, closed] = await Promise.all([
    database.opportunity.findMany({ where, include: { customer: true, contractingAuthority: true, owner: true }, orderBy: [{ deliveryAt: "asc" }, { createdAt: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    database.opportunity.count({ where }),
    database.opportunity.count(), database.opportunity.count({ where: { status: "ACTIVE" } }), database.opportunity.count({ where: { status: "QUALIFICATION" } }),
    database.opportunity.count({ where: { status: { not: "CLOSED" }, deliveryAt: { gte: now, lte: nextThirtyDays } } }), database.opportunity.count({ where: { status: "CLOSED" } }),
  ]);
  const canCreate = authorize(authorization, { permission: "opportunities.create" }).allowed;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize)); const safePage = Math.min(page, totalPages);
  const firstRecord = totalFiltered ? (safePage - 1) * pageSize + 1 : 0; const lastRecord = Math.min(safePage * pageSize, totalFiltered);

  return <main className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
    <PageHeader eyebrow="Comercial" icon="target" subtitle="Registre sinais de mercado e acompanhe sua evolução até a decisão comercial." title="Oportunidades" variant="executive"/>

    <section aria-label="Indicadores de oportunidades" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <MetricCard description="Todas as oportunidades registradas" icon="target" title="Total de oportunidades" value={total} variant="executive"/>
      <MetricCard description="Oportunidades atualmente em acompanhamento" icon="chart" title="Oportunidades ativas" value={active} variant="executive"/>
      <MetricCard description="Registros aguardando análise comercial" icon="clock" title="Em qualificação" value={qualification} variant="executive"/>
      <MetricCard description="Prazos previstos para os próximos 30 dias" icon="calendar" title="Prazos próximos" value={upcoming} variant="executive"/>
      <MetricCard description="Oportunidades encerradas com histórico preservado" icon="file" title="Encerradas" value={closed} variant="executive"/>
    </section>

    <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_3px_12px_rgba(15,23,42,0.05)]">
      <OpportunityTableControls action={canCreate ? <CreateOpportunityForm/> : undefined} pageSize={pageSize} query={query ?? ""} status={status ?? ""}/>

      <div className="overflow-x-auto"><table className="w-full min-w-[1050px] table-fixed text-left text-xs"><colgroup><col className="w-[13%]"/><col className="w-[25%]"/><col className="w-[16%]"/><col className="w-[14%]"/><col className="w-[11%]"/><col className="w-[10%]"/><col className="w-[8%]"/><col className="w-[6%]"/></colgroup><thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Código <span className="ml-1 text-[8px]">↕</span></th><th className="px-4 py-3">Objeto <span className="ml-1 text-[8px]">↕</span></th><th className="px-4 py-3">Cliente/órgão <span className="ml-1 text-[8px]">↕</span></th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3">Prazo <span className="ml-1 text-[8px]">↕</span></th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Status <span className="ml-1 text-[8px]">↕</span></th><th className="px-3 py-3 text-center">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{opportunities.map((entry) => <tr className="h-14 transition hover:bg-blue-50/30" key={entry.id}><td className="px-4 py-3"><Link className="block truncate font-bold text-brand hover:underline" href={`/opportunities/${entry.id}`}>{entry.code}</Link></td><td className="px-4 py-3"><span className="block truncate text-slate-700" title={entry.subject ?? ""}>{entry.subject ?? "—"}</span></td><td className="px-4 py-3"><span className="block truncate text-slate-600">{entry.customer?.name ?? entry.contractingAuthority?.name ?? "—"}</span></td><td className="px-4 py-3"><span className="block truncate text-slate-600">{entry.owner?.displayName ?? "Não atribuído"}</span></td><td className="whitespace-nowrap px-4 py-3 text-slate-600">{entry.deliveryAt ? entry.deliveryAt.toLocaleDateString("pt-BR") : "—"}</td><td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">{currency(entry.estimatedValue, entry.currency)}</td><td className="px-4 py-3"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone[entry.status]}`}>{statusLabels[entry.status]}</span></td><td className="px-3 py-3 text-center"><Link aria-label={`Visualizar ${entry.code}`} className="inline-grid rounded-md p-1.5 text-blue-700 transition hover:bg-blue-100" href={`/opportunities/${entry.id}`} title="Visualizar"><GsIcon className="h-4 w-4" name="eye"/></Link></td></tr>)}{opportunities.length === 0 && <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={8}>Nenhuma oportunidade encontrada.</td></tr>}</tbody></table></div>

      <footer className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-[10px] text-slate-500 sm:flex-row sm:items-center"><span>Mostrando {firstRecord} a {lastRecord} de {totalFiltered} oportunidades</span><div className="ml-auto flex items-center gap-1.5"><OpportunityPageSizeSelect pageSize={pageSize} query={query ?? ""} status={status ?? ""}/><Link aria-disabled={safePage <= 1} className={`h-8 rounded-lg border border-slate-200 px-3 py-2 font-semibold ${safePage <= 1 ? "pointer-events-none opacity-40" : ""}`} href={pageHref(filters, safePage - 1, pageSize)}>Anterior</Link><span className="grid h-8 min-w-8 place-items-center rounded-lg border border-brand font-bold text-brand">{safePage}</span><span className="px-1">de {totalPages}</span><Link aria-disabled={safePage >= totalPages} className={`h-8 rounded-lg border border-slate-200 px-3 py-2 font-semibold ${safePage >= totalPages ? "pointer-events-none opacity-40" : ""}`} href={pageHref(filters, safePage + 1, pageSize)}>Próximo</Link></div></footer>
    </section>
  </main>;
}
