"use client";

import { Fragment, useState, type ReactNode } from "react";
import Image from "next/image";

import { AttractivenessTab } from "@/app/opportunities/[id]/attractiveness-tab";
import {
  buildMapsUrl,
  formatRouteTolls,
  monthLabels,
  type IntelligenceAnalysisView,
} from "@/app/opportunities/[id]/intelligence-panel";
import { humanize } from "@/app/opportunities/[id]/intelligence-view-helpers";

type TabKind = "SUMMARY" | "DOCUMENTS" | "OVERVIEW" | "ATTRACTIVENESS" | "LOGISTICS" | "CLIMATE" | "FINANCIAL";

const analyticalTabs: { key: TabKind; label: string }[] = [
  { key: "OVERVIEW", label: "Visão geral" },
  { key: "ATTRACTIVENESS", label: "Atratividade" },
  { key: "LOGISTICS", label: "Logística e distância" },
  { key: "CLIMATE", label: "Praticabilidade" },
  { key: "FINANCIAL", label: "Capacidade financeira do cliente" },
];

/**
 * Mesma navegação da Oportunidade (intelligence-panel.tsx), só que a parte analítica
 * é só leitura — a Proposta não recalcula nada, só herda o que já foi calculado.
 */
export function InheritedAnalysis({
  analysis,
  opportunityId,
  opportunityCode,
  canReadAnalytics,
  summaryContent,
  documentsContent,
}: {
  analysis: IntelligenceAnalysisView | null;
  opportunityId: string;
  opportunityCode: string;
  canReadAnalytics: boolean;
  summaryContent: ReactNode;
  documentsContent: ReactNode;
}) {
  const [tab, setTab] = useState<TabKind>("SUMMARY");
  const navItems: { key: TabKind; label: string }[] = [
    { key: "SUMMARY", label: "Visão resumida" },
    { key: "DOCUMENTS", label: "Documentos" },
    ...(canReadAnalytics ? analyticalTabs : []),
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <nav aria-label="Seções da proposta" className="px-5 py-4">
        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1.5">
          {navItems.map((item) => (
            <button aria-current={tab === item.key ? "page" : undefined} className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold transition ${tab === item.key ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-slate-900"}`} key={item.key} onClick={() => setTab(item.key)} type="button">
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="border-t border-slate-100 p-5">
        <Fragment key="SUMMARY">{tab === "SUMMARY" && summaryContent}</Fragment>
        <Fragment key="DOCUMENTS">{tab === "DOCUMENTS" && documentsContent}</Fragment>
        <Fragment key="NO_ANALYSIS">{tab !== "SUMMARY" && tab !== "DOCUMENTS" && !analysis && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">A oportunidade {opportunityCode} ainda não possui uma análise calculada.</p>
        )}</Fragment>
        <Fragment key="OVERVIEW">{tab === "OVERVIEW" && analysis && <OverviewReadOnly analysis={analysis}/>}</Fragment>
        <Fragment key="ATTRACTIVENESS">{tab === "ATTRACTIVENESS" && analysis && <AttractivenessTab canRegister={false} opportunityId={opportunityId}/>}</Fragment>
        <Fragment key="LOGISTICS">{tab === "LOGISTICS" && analysis && <LogisticsReadOnly route={analysis.route}/>}</Fragment>
        <Fragment key="CLIMATE">{tab === "CLIMATE" && analysis && <ClimateReadOnly climate={analysis.climate}/>}</Fragment>
        <Fragment key="FINANCIAL">{tab === "FINANCIAL" && analysis && <FinancialReadOnly financial={analysis.financial}/>}</Fragment>
      </div>
    </section>
  );
}

function OverviewReadOnly({ analysis }: { analysis: IntelligenceAnalysisView }) {
  const technical = analysis.dimensions.find((item) => item.perspective === "TECHNICAL");
  const commercial = analysis.dimensions.find((item) => item.perspective === "COMMERCIAL");
  const openPending = analysis.pendingItems.filter((item) => item.status === "OPEN");
  const openImpediments = analysis.impediments.filter((item) => item.status === "OPEN");

  return (
    <div className="space-y-5">
      {analysis.executiveSummary && <p className="text-sm leading-6 text-slate-600">{analysis.executiveSummary}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <ReadOnlyCard detail={technical?.summary ?? "Aguardando cálculo."} label="Capacidade técnica"/>
        <ReadOnlyCard detail={commercial?.summary ?? "Aguardando cálculo."} label="Atratividade comercial (avaliação automática)"/>
        <ReadOnlyCard detail={openPending.length > 0 ? openPending.map((item) => item.description).join(" · ") : "Nenhuma pendência em aberto."} label={`Pendências (${openPending.length})`}/>
        <ReadOnlyCard detail={openImpediments.length > 0 ? openImpediments.map((item) => item.summary).join(" · ") : "Nenhum impedimento em aberto."} label={`Impedimentos (${openImpediments.length})`}/>
      </div>
      {analysis.decision && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-[9px] font-black uppercase tracking-wide text-emerald-700">Decisão empresarial registrada</p>
          <h4 className="mt-1 font-black text-emerald-950">{humanize(analysis.decision.decision)}</h4>
          <p className="mt-2 text-sm leading-6 text-emerald-900">{analysis.decision.justification}</p>
          <p className="mt-2 text-[10px] text-emerald-700">{new Date(analysis.decision.decidedAt).toLocaleString("pt-BR")}</p>
        </section>
      )}
    </div>
  );
}

function ReadOnlyCard({ label, detail }: { label: string; detail: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-2 text-xs leading-5 text-slate-600">{detail}</p>
    </article>
  );
}

function LogisticsReadOnly({ route }: { route: IntelligenceAnalysisView["route"] }) {
  if (!route) return <EmptyReadOnly text="Ainda não há estudo logístico para esta oportunidade."/>;
  const best = route.alternatives.filter((item) => item.condition === "ROUTE_EXISTS").sort((left, right) => (left.distanceKm ?? Infinity) - (right.distanceKm ?? Infinity))[0];
  const mapUrl = best ? buildMapsUrl(route, best) : undefined;
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        <div className="relative grid min-h-72 place-items-center">
          {mapUrl ? <Image alt={`Rota da base ${best?.baseName} para ${route.destinationLabel}`} className="object-cover" fill sizes="100vw" src={mapUrl} unoptimized/> : <p className="px-6 text-center text-sm text-slate-500">Nenhuma rota válida foi retornada para exibição no Azure Maps.</p>}
        </div>
      </section>
      <section className="rounded-xl border border-slate-200">
        <header className="border-b border-slate-100 px-4 py-3">
          <h3 className="font-black text-slate-900">Rota calculada</h3>
          <p className="mt-1 text-xs text-slate-500"><span className="font-bold text-slate-700">Chegada:</span> {route.destinationLabel}</p>
        </header>
        <div className="divide-y divide-slate-100">
          {route.alternatives.map((item) => (
            <article className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto_auto_auto]" key={item.baseId}>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Partida</p>
                <p className="font-bold text-slate-900">{item.baseCode} · {item.baseName}</p>
                <p className="text-xs text-slate-500">{item.baseLocality}</p>
              </div>
              <MiniMetric label="Distância" value={item.distanceKm === undefined ? "Sem rota" : `${item.distanceKm.toLocaleString("pt-BR")} km`}/>
              <MiniMetric label="Duração" value={item.durationHours === undefined ? "—" : `${item.durationHours.toLocaleString("pt-BR")} h`}/>
              <MiniMetric label="Pedágios" value={formatRouteTolls(item.tolls)}/>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ClimateReadOnly({ climate }: { climate: IntelligenceAnalysisView["climate"] }) {
  if (!climate) return <EmptyReadOnly text="Ainda não há estudo climático para esta oportunidade."/>;
  const max = Math.max(1, ...climate.monthlySeries.map((item) => item.precipitationMm));
  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 p-5">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-900">{climate.locationLabel}</h3>
            <p className="mt-1 text-xs text-slate-500">{climate.provider} · histórico de {new Date(climate.historyStart).toLocaleDateString("pt-BR")} a {new Date(climate.historyEnd).toLocaleDateString("pt-BR")}</p>
          </div>
          <span className="h-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">Cobertura {Math.round(climate.dataCoverage)}%</span>
        </div>
        <p className="mt-3 text-xs text-slate-500">Período previsto da obra: {new Date(climate.workStart).toLocaleDateString("pt-BR")} a {new Date(climate.workEnd).toLocaleDateString("pt-BR")}</p>
      </section>
      <section className="rounded-xl border border-slate-200 p-5">
        <h3 className="font-black text-slate-900">Precipitação histórica mensal</h3>
        <div aria-hidden="true" className="mt-6 flex h-56 items-end gap-1.5 border-b border-slate-200 px-1">
          {monthLabels.map((label, index) => {
            const item = climate.monthlySeries.find((entry) => entry.month === index + 1);
            const height = item ? Math.max(4, item.precipitationMm / max * 100) : 0;
            return (
              <div className="flex h-full min-w-0 flex-1 flex-col justify-end text-center" key={label}>
                <span className="mb-1 text-[8px] font-bold text-slate-500">{item ? Math.round(item.precipitationMm) : "—"}</span>
                <span className="mx-auto w-full max-w-7 rounded-t bg-gradient-to-t from-blue-700 to-blue-400" style={{ height: `${height}%` }}/>
                <span className="mt-2 text-[8px] font-bold text-slate-500">{label}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function FinancialReadOnly({ financial }: { financial: IntelligenceAnalysisView["financial"] }) {
  if (!financial) return <EmptyReadOnly text="Não há avaliação financeira consolidada."/>;
  return (
    <section className="rounded-xl border border-slate-200 p-5">
      <h3 className="font-black text-slate-900">Conclusão consolidada</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{financial.summary}</p>
      {(financial.highIndebtednessRisk !== undefined || financial.nonPayingCustomer !== undefined) && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <RiskFlag active={financial.highIndebtednessRisk === true} label="Alto risco de endividamento"/>
          <RiskFlag active={financial.nonPayingCustomer === true} label="Cliente classificado como não pagador"/>
        </div>
      )}
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-xs font-black text-slate-800">{value}</p></div>;
}

function RiskFlag({ active, label }: { active: boolean; label: string }) {
  return <div className={`rounded-xl border p-4 ${active ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}><p className={`text-xs font-black ${active ? "text-red-800" : "text-emerald-800"}`}>{active ? "Atenção crítica" : "Não identificado"}</p><p className={`mt-1 text-xs ${active ? "text-red-700" : "text-emerald-700"}`}>{label}</p></div>;
}

function EmptyReadOnly({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center"><p className="text-sm leading-6 text-slate-500">{text}</p></div>;
}
