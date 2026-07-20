import Link from "next/link";
import { redirect } from "next/navigation";
import { getDatabase } from "@/core/database/prisma";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { GsIcon } from "@/components/ui/gs-icon";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

type MonthMetric = { label: string; proposals: number; wins: number; revenue: number };
type DashboardData = {
  volume: number;
  delivered: number;
  inProgress: number;
  conversionQuantity: number;
  conversionValue: number;
  onTimeRate: number;
  revenue: number;
  leadTime: number | null;
  accuracy: number | null;
  reworkRate: number;
  pipeline: Record<string, number>;
  monthly: MonthMetric[];
  upcomingDeadlines: Array<{ id: string; label: string; dueAt: Date; daysRemaining: number }>;
};

const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const percent = (value: number) => `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

async function loadDashboard(year: number): Promise<DashboardData> {
  const db = getDatabase();
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const now = new Date();
  const nextThirtyDays = new Date(now.getTime() + 30 * 86400000);
  const periodFilter = { createdAt: { gte: start, lt: end }, deletedAt: null };

  const [proposals, results, pipelineRows, upcomingDeadlines] = await Promise.all([
    db.proposal.findMany({
      where: periodFilter,
      select: { createdAt: true, status: true, opportunity: { select: { deliveryAt: true } }, submissions: { select: { submittedAt: true }, orderBy: { submittedAt: "asc" }, take: 1 }, _count: { select: { versions: true } } },
    }),
    db.competitionResult.findMany({
      where: { resultDate: { gte: start, lt: end }, nextVersions: { none: {} }, validation: { isNot: null } },
      select: { outcome: true, resultDate: true, award: { select: { contractValue: true, currency: true } }, competition: { select: { tender: { select: { opportunity: { select: { estimatedValue: true, currency: true } } } } } } },
    }),
    db.proposal.groupBy({ by: ["status"], where: periodFilter, _count: { _all: true } }),
    db.tenderDeadline.findMany({ where: { dueAt: { gte: now, lte: nextThirtyDays }, status: { in: ["PENDING_CONFIRMATION", "CONFIRMED"] } }, select: { id: true, event: true, dueAt: true }, orderBy: { dueAt: "asc" }, take: 6 }),
  ]);

  const decided = results.length;
  const wins = results.filter((item) => item.outcome === "WIN");
  const disputedValue = results.reduce((sum, item) => item.competition.tender.opportunity?.currency === "BRL" ? sum + Number(item.competition.tender.opportunity.estimatedValue ?? 0) : sum, 0);
  const revenue = wins.reduce((sum, item) => item.award?.currency === "BRL" ? sum + Number(item.award.contractValue) : sum, 0);
  const sent = proposals.filter((item) => item.submissions.length > 0 || item.status === "SENT");
  const onTime = sent.filter((item) => item.submissions[0] && item.opportunity.deliveryAt && item.submissions[0].submittedAt <= item.opportunity.deliveryAt).length;
  const assessedDeadline = sent.filter((item) => item.submissions[0] && item.opportunity.deliveryAt).length;
  const leadTimes = sent.flatMap((item) => item.submissions[0] ? [(item.submissions[0].submittedAt.getTime() - item.createdAt.getTime()) / 86400000] : []).filter((value) => value >= 0);
  const reworked = proposals.filter((item) => item._count.versions > 1).length;
  const inProgress = proposals.filter((item) => ["PREPARATION", "REVIEW", "APPROVAL"].includes(item.status) && (!item.opportunity.deliveryAt || item.opportunity.deliveryAt >= now)).length;
  const monthly = monthLabels.map((label, month) => ({
    label,
    proposals: proposals.filter((item) => item.createdAt.getUTCMonth() === month).length,
    wins: wins.filter((item) => item.resultDate.getUTCMonth() === month).length,
    revenue: wins.filter((item) => item.resultDate.getUTCMonth() === month && item.award?.currency === "BRL").reduce((sum, item) => sum + Number(item.award?.contractValue ?? 0), 0),
  }));

  return {
    volume: proposals.length,
    delivered: sent.length,
    inProgress,
    conversionQuantity: decided ? wins.length / decided * 100 : 0,
    conversionValue: disputedValue ? revenue / disputedValue * 100 : 0,
    onTimeRate: assessedDeadline ? onTime / assessedDeadline * 100 : 0,
    revenue,
    leadTime: leadTimes.length ? leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length : null,
    accuracy: null,
    reworkRate: proposals.length ? reworked / proposals.length * 100 : 0,
    pipeline: Object.fromEntries(pipelineRows.map((row) => [row.status, row._count._all])),
    monthly,
    upcomingDeadlines: upcomingDeadlines.map((item) => ({ id: item.id, label: item.event, dueAt: item.dueAt, daysRemaining: Math.max(0, Math.ceil((item.dueAt.getTime() - now.getTime()) / 86400000)) })),
  };
}

export default async function Home({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorization?.isMaster) {
    const destinations = [["opportunities.read", "/opportunities"], ["proposals.read", "/proposals"], ["technical-archive.read", "/technical-archive"], ["indicators.read", "/indicators"]] as const;
    const destination = destinations.find(([permission]) => authorization?.permissions.has(permission));
    if (destination) redirect(destination[1]);
    return <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-10"><section className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-8"><p className="text-xs font-bold uppercase tracking-wider text-amber-800">Controle de acesso</p><h1 className="mt-2 text-2xl font-black text-amber-950">Acesso aguardando configuração</h1><p className="mt-3 leading-7 text-amber-900">Seu login corporativo foi reconhecido, mas o administrador ainda não liberou módulos para este usuário.</p></section></main>;
  }
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const parsedYear = Number(params.year);
  const year = Number.isInteger(parsedYear) && parsedYear >= 2020 && parsedYear <= currentYear + 1 ? parsedYear : currentYear;
  const data = await loadDashboard(year);
  const maxMonthly = Math.max(1, ...data.monthly.map((item) => item.proposals));
  const pipeline = [
    ["Em preparação", data.pipeline.PREPARATION ?? 0, "bg-blue-500"],
    ["Em revisão", data.pipeline.REVIEW ?? 0, "bg-violet-500"],
    ["Em aprovação", data.pipeline.APPROVAL ?? 0, "bg-amber-500"],
    ["Entregues", data.pipeline.SENT ?? 0, "bg-emerald-500"],
    ["Finalizadas", (data.pipeline.FINALIZED ?? 0) + (data.pipeline.JUDGED ?? 0), "bg-emerald-700"],
  ] as const;
  const pipelineTotal = Math.max(1, pipeline.reduce((sum, item) => sum + item[1], 0));
  const performance = [
    ["Entregues no prazo", percent(data.onTimeRate), "Envios realizados até a data-limite"],
    ["Conversão por valor", percent(data.conversionValue), "Valor contratado sobre o valor disputado"],
    ["Lead time de elaboração", data.leadTime === null ? "N/D" : `${data.leadTime.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`, "Tempo médio entre abertura e envio"],
    ["Taxa de retrabalho", percent(data.reworkRate), "Propostas com mais de uma versão"],
    ["Acurácia orçamentária", data.accuracy === null ? "N/D" : percent(data.accuracy), "Disponível após cadastro do custo final"],
  ] as const;

  const headerAction = <><form className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-sm"><label className="text-xs font-bold text-slate-500" htmlFor="year">Período</label><select className="bg-transparent text-sm font-bold outline-none" defaultValue={year} id="year" name="year">{Array.from({ length: 5 }, (_, index) => currentYear - index).map((value) => <option key={value}>{value}</option>)}</select><button className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">Aplicar</button></form><Link className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-bold text-white shadow-md shadow-blue-900/15 transition hover:-translate-y-0.5 hover:bg-blue-700" href="/proposals?new=1"><span className="text-lg font-normal">＋</span> Nova proposta</Link></>;

  return <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <PageHeader action={headerAction} eyebrow="Visão geral" icon="dashboard" subtitle="Acompanhamento comercial e operacional com dados consolidados do G-SIPRO." title="Dashboard" />

    <section aria-label="Indicadores principais" className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard description={`Propostas cadastradas em ${year}`} icon="file" title="Total de propostas" tone="blue" value={data.volume}/>
      <MetricCard description="Propostas em elaboração, revisão ou análise" icon="clock" title="Em andamento" tone="amber" value={data.inProgress}/>
      <MetricCard description="Propostas enviadas ou entregues ao cliente" icon="send" title="Propostas entregues" tone="green" value={data.delivered}/>
      <MetricCard description="Vitórias sobre resultados validados" icon="target" title="Conversão por quantidade" tone="violet" value={percent(data.conversionQuantity)}/>
      <MetricCard description="Contratos ganhos e validados em BRL" icon="money" title="Receita contratada" tone="green" value={currency(data.revenue)}/>
    </section>

    <section className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      <Panel action={<span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-brand">Mensal · {year}</span>} subtitle="Volume de propostas abertas e vitórias registradas" title="Evolução das propostas">
        <div className="px-5 pb-5 pt-7 sm:px-6"><div className="flex h-72 items-end gap-2 border-b border-slate-200 sm:gap-4">{data.monthly.map((item) => <div className="flex h-full min-w-0 flex-1 flex-col justify-end text-center" key={item.label}><span className="mb-2 text-xs font-bold text-slate-700">{item.proposals || ""}</span><div className="group relative mx-auto flex w-full max-w-11 items-end justify-center rounded-t-lg bg-blue-100" style={{ height: `${Math.max(item.proposals ? 10 : 2, item.proposals / maxMonthly * 82)}%` }}><div className="h-full w-full rounded-t-lg bg-gradient-to-t from-blue-700 to-blue-400"/>{item.wins > 0 && <span className="absolute -right-1 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-emerald-500 px-1 text-[9px] font-black text-white" title={`${item.wins} vitória(s)`}>{item.wins}</span>}</div><span className="mt-3 pb-3 text-[10px] font-semibold text-slate-500">{item.label}</span></div>)}</div><div className="mt-4 flex flex-wrap gap-5 text-xs text-slate-500"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-blue-600"/> Propostas abertas</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500"/> Vitórias</span></div></div>
      </Panel>

      <Panel subtitle="Distribuição das propostas do período por etapa" title="Pipeline de propostas">
        <div className="space-y-5 p-6">{pipeline.map(([label, count, color]) => <div key={label}><div className="mb-2 flex justify-between text-sm"><span className="font-semibold text-slate-600">{label}</span><strong className="text-slate-900">{count}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${count / pipelineTotal * 100}%` }}/></div></div>)}</div>
      </Panel>
    </section>

    <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.25fr]">
      <Panel subtitle="Indicadores complementares do período selecionado" title="Desempenho operacional">
        <div className="divide-y divide-slate-100">{performance.map(([label, value, hint]) => <div className="flex items-center gap-4 px-6 py-4" key={label}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-50 text-brand"><GsIcon className="h-4 w-4" name="chart"/></span><div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-800">{label}</p><p className="mt-0.5 text-xs text-slate-500">{hint}</p></div><strong className="whitespace-nowrap text-base text-slate-950">{value}</strong></div>)}</div>
      </Panel>

      <Panel action={<Link className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline" href="/tenders">Ver editais <GsIcon className="h-3 w-3" name="arrow"/></Link>} subtitle="Vencimentos confirmados para os próximos 30 dias" title="Próximos prazos">
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-3">Data</th><th className="px-6 py-3">Evento</th><th className="px-6 py-3">Situação</th></tr></thead><tbody className="divide-y divide-slate-100">{data.upcomingDeadlines.map((item) => <tr className="transition hover:bg-blue-50/30" key={item.id}><td className="whitespace-nowrap px-6 py-4 font-bold text-slate-800">{item.dueAt.toLocaleDateString("pt-BR")}</td><td className="px-6 py-4 text-slate-700">{item.label}</td><td className="px-6 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.daysRemaining <= 7 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{item.daysRemaining === 0 ? "Hoje" : `${item.daysRemaining} dias`}</span></td></tr>)}{!data.upcomingDeadlines.length && <tr><td className="px-6 py-10 text-center text-slate-400" colSpan={3}>Nenhum prazo registrado para os próximos 30 dias.</td></tr>}</tbody></table></div>
      </Panel>
    </section>

    <Panel className="mt-6" subtitle="Acesse rapidamente os módulos mais utilizados" title="Operação comercial">
      <div className="grid gap-3 p-6 sm:grid-cols-2 xl:grid-cols-4">{[["Oportunidades", "Registre e acompanhe novas oportunidades", "/opportunities", "target"], ["Propostas", "Cadastre e analise documentos", "/proposals", "file"], ["Acervo técnico", "Consulte atestados e quantitativos", "/technical-archive", "pipeline"], ["Inteligência e KPIs", "Acompanhe indicadores consolidados", "/indicators", "chart"]].map(([label, hint, href, icon]) => <Link className="group rounded-xl border border-slate-200 p-4 transition hover:border-blue-200 hover:bg-blue-50/40" href={href} key={label}><span className="grid h-10 w-10 place-items-center rounded-full bg-blue-50 text-brand group-hover:bg-brand group-hover:text-white"><GsIcon className="h-4 w-4" name={icon as "target"}/></span><p className="mt-3 font-bold text-slate-900">{label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p></Link>)}</div>
    </Panel>
  </div>;
}
