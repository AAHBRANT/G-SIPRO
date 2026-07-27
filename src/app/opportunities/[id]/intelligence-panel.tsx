"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { GsIcon } from "@/components/ui/gs-icon";
import type { AnalysisContextDefaults } from "./analysis-context-defaults";
import {
  FinancialAssessmentManager,
  type FinancialSubject,
} from "./financial-assessment-manager";
import { humanize } from "./intelligence-view-helpers";

type TabKind = "OVERVIEW" | "ATTRACTIVENESS" | "LOGISTICS" | "CLIMATE" | "FINANCIAL";

export type IntelligenceDimensionView = Readonly<{
  id: string;
  perspective: "COMMERCIAL" | "TECHNICAL" | "STUDIES";
  code: string;
  status: string;
  score: number | null;
  confidence: number;
  summary: string;
  risks: readonly string[];
  pendingCount: number;
  evidenceCount: number;
  technicalBreakdown?: {
    totalRequirements?: number;
    assessedRequirements?: number;
    metRequirements?: number;
    partialRequirements?: number;
    unmetRequirements?: number;
  };
}>;

export type ClimateView = Readonly<{
  locationLabel: string;
  provider: string;
  workStart: string;
  workEnd: string;
  historyStart: string;
  historyEnd: string;
  dataCoverage: number;
  monthlySeries: readonly {
    month: number;
    precipitationMm: number;
    averageTemperatureC?: number;
    completeness: number;
  }[];
}>;

export type RouteAlternativeView = Readonly<{
  baseId: string;
  baseCode: string;
  baseName: string;
  baseLocality: string;
  origin: { latitude: number; longitude: number };
  condition: string;
  distanceKm?: number;
  durationHours?: number;
  tolls: readonly {
    currencyCode: string;
    units: string;
    nanos: number;
  }[];
}>;

export type RouteView = Readonly<{
  destinationLabel: string;
  destinationLat: number;
  destinationLng: number;
  provider: string;
  selectedBaseId?: string;
  selectionStatus: string;
  alternatives: readonly RouteAlternativeView[];
}>;

export type IntelligenceAnalysisView = Readonly<{
  id: string;
  version: number;
  status: string;
  score: number | null;
  coverage: number | null;
  confidence: number | null;
  recommendation: string | null;
  executiveSummary: string | null;
  completedAt: string | null;
  policy: { name: string; version: number };
  dimensions: readonly IntelligenceDimensionView[];
  pendingItems: readonly {
    id: string;
    description: string;
    reason: string;
    requiredInformation: string;
    status: string;
  }[];
  impediments: readonly {
    id: string;
    type: string;
    severity: string;
    summary: string;
    status: string;
  }[];
  financial?: {
    summary: string;
    highIndebtednessRisk?: boolean;
    nonPayingCustomer?: boolean;
  };
  decision?: {
    id: string;
    decision: string;
    justification: string;
    decidedAt: string;
  };
  climate?: ClimateView;
  route?: RouteView;
}>;

export type OperationalBaseOption = Readonly<{
  id: string;
  code: string;
  name: string;
  locality: string;
}>;

const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const tabs: { key: TabKind; label: string }[] = [
  { key: "OVERVIEW", label: "Visão geral" },
  { key: "ATTRACTIVENESS", label: "Atratividade" },
  { key: "LOGISTICS", label: "Logística e distância" },
  { key: "CLIMATE", label: "Praticabilidade" },
  { key: "FINANCIAL", label: "Capacidade financeira do cliente" },
];

function buildMapsUrl(route: RouteView, alternative?: RouteAlternativeView) {
  if (!alternative) return "";
  const query = new URLSearchParams({
    originLat: alternative.origin.latitude.toString(),
    originLng: alternative.origin.longitude.toString(),
    destinationLat: route.destinationLat.toString(),
    destinationLng: route.destinationLng.toString(),
  });
  return `/api/maps/route?${query}`;
}

export function formatRouteTolls(tolls: RouteAlternativeView["tolls"]) {
  if (tolls.length === 0) return "Não informado";
  const totals = new Map<string, number>();
  for (const toll of tolls) {
    const value = Number(toll.units) + toll.nanos / 1_000_000_000;
    totals.set(toll.currencyCode, (totals.get(toll.currencyCode) ?? 0) + value);
  }
  return [...totals.entries()]
    .map(([currency, value]) => value.toLocaleString("pt-BR", { style: "currency", currency }))
    .join(" + ");
}

export function IntelligencePanel({
  opportunityId,
  opportunityCode,
  analysis,
  canCalculate,
  canReadFinancial,
  canAssessFinancial,
  canAssessClientRisk,
  financialSubject,
  canDecide,
  isOwner,
  contextDefaults,
  operationalBases,
}: {
  opportunityId: string;
  opportunityCode: string;
  analysis: IntelligenceAnalysisView | null;
  canCalculate: boolean;
  canReadFinancial: boolean;
  canAssessFinancial: boolean;
  canAssessClientRisk: boolean;
  financialSubject?: FinancialSubject;
  canDecide: boolean;
  isOwner: boolean;
  contextDefaults: AnalysisContextDefaults;
  operationalBases: readonly OperationalBaseOption[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKind>("OVERVIEW");
  const [busyStage, setBusyStage] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function runStage(stage: "COMMERCIAL" | "TECHNICAL" | "FINANCIAL") {
    setBusyStage(stage);
    setMessage(stage === "FINANCIAL" ? "Executando avaliação financeira…" : stage === "COMMERCIAL" ? "Executando avaliação comercial…" : "Executando capacidade técnica…");
    try {
      const response = await fetch(`/api/opportunities/${opportunityId}/intelligence/run`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `${stage.toLowerCase()}-${opportunityId}-${Date.now()}`,
        },
        body: JSON.stringify({ stage }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      setBusyStage(null);
      setMessage(response.ok ? "Análise concluída e versionada." : result.error?.message ?? "Não foi possível executar a análise.");
      if (response.ok) router.refresh();
    } catch {
      setBusyStage(null);
      setMessage("Falha de conexão. Verifique sua rede e tente novamente.");
    }
  }

  async function runContextualStage(
    event: FormEvent<HTMLFormElement>,
    stage: "CLIMATE" | "LOGISTICS",
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const latitude = form.get("latitude")?.toString().trim();
    const longitude = form.get("longitude")?.toString().trim();
    if (!latitude || !longitude) {
      setMessage("Localize a cidade ou o endereço antes de executar o estudo. Se necessário, utilize a localização avançada.");
      return;
    }
    const payload = stage === "CLIMATE"
      ? {
          climateContext: {
            locationLabel: form.get("locationLabel"),
            latitude: Number(latitude),
            longitude: Number(longitude),
            workStart: form.get("workStart"),
            workEnd: form.get("workEnd"),
          },
        }
      : {
          routeBaseId: form.get("routeBaseId"),
          routeDestination: {
            label: form.get("locationLabel"),
            latitude: Number(latitude),
            longitude: Number(longitude),
            travelMode: "DRIVE",
          },
        };
    setBusyStage(stage);
    setMessage(stage === "CLIMATE" ? "Consultando dados climáticos autorizados…" : "Calculando rotas das bases operacionais…");
    try {
      const response = await fetch(`/api/opportunities/${opportunityId}/intelligence/run`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `${stage.toLowerCase()}-${opportunityId}-${Date.now()}`,
        },
        body: JSON.stringify({ stage, ...payload }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      setBusyStage(null);
      setMessage(response.ok ? "Estudo concluído e incorporado à nova versão." : result.error?.message ?? "Não foi possível concluir o estudo.");
      if (response.ok) router.refresh();
    } catch {
      setBusyStage(null);
      setMessage("Falha de conexão. Verifique sua rede e tente novamente.");
    }
  }

  if (!analysis) {
    return (
      <section aria-labelledby="intelligence-title" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
        <PanelHeader opportunityCode={opportunityCode}/>
        <div className="grid min-h-64 place-items-center px-6 py-12 text-center">
          <div className="max-w-lg">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-600"><GsIcon name="chart"/></span>
            <h3 className="mt-4 text-lg font-black text-slate-900">Nenhuma análise executada</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">Inicie pela avaliação comercial. Cada nova etapa gera uma versão rastreável sem alterar os dados originais da oportunidade.</p>
            {canCalculate && <button className="mt-5 rounded-lg bg-brand px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50" disabled={Boolean(busyStage)} onClick={() => runStage("COMMERCIAL")} type="button">{busyStage === "COMMERCIAL" ? "Iniciando…" : "Iniciar análise"}</button>}
            {message && <p aria-live="polite" className="mt-3 text-xs font-semibold text-slate-600" role="status">{message}</p>}
          </div>
        </div>
      </section>
    );
  }

  const commercialDimension = analysis.dimensions.find((item) => item.perspective === "COMMERCIAL");
  const technicalDimension = analysis.dimensions.find((item) => item.perspective === "TECHNICAL");

  return (
    <section aria-labelledby="intelligence-title" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
      <PanelHeader opportunityCode={opportunityCode}/>

      <nav aria-label="Seções da análise" className="flex gap-1 overflow-x-auto border-b border-slate-100 px-5 sm:px-7">
        {tabs.map((item) => (
          <button aria-current={tab === item.key ? "page" : undefined} className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs font-bold transition ${tab === item.key ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-slate-900"}`} key={item.key} onClick={() => setTab(item.key)} type="button">
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-5 sm:p-7">
        {tab === "OVERVIEW" && (
          <OverviewTab
            analysis={analysis}
            busyStage={busyStage}
            canCalculate={canCalculate}
            canDecide={canDecide}
            commercialDimension={commercialDimension}
            isOwner={isOwner}
            message={message}
            onDecisionSaved={() => router.refresh()}
            onRunStage={runStage}
            technicalDimension={technicalDimension}
          />
        )}
        {tab === "ATTRACTIVENESS" && (
          <EmptyDetail text="Em construção: aqui você vai poder registrar, ponto a ponto, o que torna esta oportunidade atrativa (preço praticado x mercado, economias de estrutura, acervo técnico etc.), separando o que é qualitativo do que dá para precificar."/>
        )}
        {tab === "LOGISTICS" && (
          <LogisticsTab analysis={analysis} bases={operationalBases} busy={busyStage === "LOGISTICS"} canCalculate={canCalculate} contextDefaults={contextDefaults} message={message} onSubmit={(event) => runContextualStage(event, "LOGISTICS")}/>
        )}
        {tab === "CLIMATE" && (
          <ClimateTab analysis={analysis} busy={busyStage === "CLIMATE"} canCalculate={canCalculate} contextDefaults={contextDefaults} message={message} onSubmit={(event) => runContextualStage(event, "CLIMATE")}/>
        )}
        {tab === "FINANCIAL" && (
          <FinancialTab analysis={analysis} busy={busyStage === "FINANCIAL"} canAssessClientRisk={canAssessClientRisk} canAssessFinancial={canAssessFinancial} canCalculate={canCalculate} canReadFinancial={canReadFinancial} financialSubject={financialSubject} onRun={() => runStage("FINANCIAL")} opportunityId={opportunityId}/>
        )}
      </div>
    </section>
  );
}

function PanelHeader({ opportunityCode }: { opportunityCode: string }) {
  return (
    <header className="border-b border-slate-100 px-5 py-5 sm:px-7">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand">Inteligência</p>
      <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950" id="intelligence-title">Modo Analítico Inteligente</h2>
      <p className="mt-1 text-xs text-slate-500">Avaliação assistida da oportunidade {opportunityCode}.</p>
    </header>
  );
}

function OverviewTab({
  analysis,
  technicalDimension,
  commercialDimension,
  canCalculate,
  canDecide,
  isOwner,
  busyStage,
  message,
  onRunStage,
  onDecisionSaved,
}: {
  analysis: IntelligenceAnalysisView;
  technicalDimension?: IntelligenceDimensionView;
  commercialDimension?: IntelligenceDimensionView;
  canCalculate: boolean;
  canDecide: boolean;
  isOwner: boolean;
  busyStage: string | null;
  message: string;
  onRunStage: (stage: "COMMERCIAL" | "TECHNICAL" | "FINANCIAL") => void;
  onDecisionSaved: () => void;
}) {
  const openPending = analysis.pendingItems.filter((item) => item.status === "OPEN");
  const openImpediments = analysis.impediments.filter((item) => item.status === "OPEN");

  return (
    <div className="space-y-5">
      {message && <p aria-live="polite" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-semibold leading-5 text-blue-900" role="status">{message}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <TechnicalCapacityCard busy={busyStage === "TECHNICAL"} canCalculate={canCalculate} dimension={technicalDimension} onRecalculate={() => onRunStage("TECHNICAL")}/>
        <CommercialAutomaticCard busy={busyStage === "COMMERCIAL"} canCalculate={canCalculate} dimension={commercialDimension} onRecalculate={() => onRunStage("COMMERCIAL")}/>
        <ExpandableInfoCard emptyText="A versão atual não possui pendências registradas." items={openPending.map((item) => ({ id: item.id, title: item.description, detail: `${item.reason} — ${item.requiredInformation}` }))} label="Pendências" tone="text-amber-700"/>
        <ExpandableInfoCard emptyText="Nenhum impedimento em aberto." items={openImpediments.map((item) => ({ id: item.id, title: item.summary, detail: humanize(item.type) }))} label="Impedimentos" tone={openImpediments.length > 0 ? "text-red-700" : "text-emerald-700"}/>
      </div>
      {canDecide && <DecisionSection analysis={analysis} isOwner={isOwner} onSaved={onDecisionSaved}/>}
    </div>
  );
}

function TechnicalCapacityCard({ dimension, canCalculate, busy, onRecalculate }: { dimension?: IntelligenceDimensionView; canCalculate: boolean; busy: boolean; onRecalculate: () => void }) {
  const breakdown = dimension?.technicalBreakdown;
  const total = breakdown?.totalRequirements ?? 0;
  const met = breakdown?.metRequirements ?? 0;
  const partial = breakdown?.partialRequirements ?? 0;
  const unmet = breakdown?.unmetRequirements ?? 0;
  const hasBreakdown = total > 0;
  const legacyStatusLabel: Record<string, string> = { CALCULATED: "Calculado", NOT_CALCULABLE: "Não calculável" };
  const statusLabel = !dimension
    ? "Aguardando cálculo"
    : !hasBreakdown ? (legacyStatusLabel[dimension.status] ?? humanize(dimension.status))
      : unmet > 0 ? "Não atende integralmente" : partial > 0 ? "Atende parcialmente" : "Atende integralmente";
  const statusTone = !dimension ? "text-slate-500" : !hasBreakdown ? "text-slate-700" : unmet > 0 ? "text-red-700" : partial > 0 ? "text-amber-700" : "text-emerald-700";
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Capacidade técnica</p>
        {canCalculate && <button className="text-[10px] font-bold text-brand hover:underline disabled:opacity-50" disabled={busy} onClick={onRecalculate} type="button">{busy ? "Calculando…" : "Recalcular"}</button>}
      </div>
      <p className={`mt-2 text-sm font-black ${statusTone}`}>{statusLabel}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        {hasBreakdown ? `Atende ${met} de ${total} item(ns)${partial > 0 ? `, ${partial} parcial(is)` : ""}${unmet > 0 ? `, ${unmet} não atende(m)` : ""}.` : dimension?.summary ?? "Execute o cálculo para ver quantos itens da matriz de atendimento são cumpridos."}
      </p>
    </article>
  );
}

function CommercialAutomaticCard({ dimension, canCalculate, busy, onRecalculate }: { dimension?: IntelligenceDimensionView; canCalculate: boolean; busy: boolean; onRecalculate: () => void }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Atratividade comercial (avaliação automática)</p>
        {canCalculate && <button className="text-[10px] font-bold text-brand hover:underline disabled:opacity-50" disabled={busy} onClick={onRecalculate} type="button">{busy ? "Calculando…" : "Atualizar"}</button>}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">{dimension?.summary ?? "Aguardando cálculo."}</p>
      <p className="mt-2 text-[10px] text-slate-400">Complementa o registro manual feito na aba &ldquo;Atratividade&rdquo;.</p>
    </article>
  );
}

function ExpandableInfoCard({ label, items, emptyText, tone }: { label: string; items: { id: string; title: string; detail: string }[]; emptyText: string; tone: string }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <button className="flex w-full items-start justify-between gap-2 text-left" disabled={items.length === 0} onClick={() => setOpen((value) => !value)} type="button">
        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
        {items.length > 0 && <GsIcon className={`h-3.5 w-3.5 text-slate-400 transition ${open ? "rotate-180" : ""}`} name="arrow"/>}
      </button>
      <p className={`mt-2 text-2xl font-black ${tone}`}>{items.length}</p>
      <p className="mt-1 text-[10px] text-slate-500">Orientativo — não bloqueia o andamento.</p>
      {open && items.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {items.map((item) => (
            <li className="text-xs leading-5" key={item.id}>
              <p className="font-bold text-slate-800">{item.title}</p>
              <p className="text-slate-500">{item.detail}</p>
            </li>
          ))}
        </ul>
      )}
      {items.length === 0 && <p className="mt-3 text-xs text-slate-400">{emptyText}</p>}
    </article>
  );
}

function DecisionSection({ analysis, isOwner, onSaved }: { analysis: IntelligenceAnalysisView; isOwner: boolean; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const hasCriticalContext = analysis.recommendation === "NOT_RECOMMENDED"
    || analysis.impediments.some((item) => item.status === "OPEN");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("Registrando decisão imutável…");
    const response = await fetch(`/api/opportunity-analyses/${analysis.id}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        decision: form.get("decision"),
        justification: form.get("justification"),
      }),
    });
    const result = await response.json().catch(() => ({})) as { error?: { message?: string } };
    setBusy(false);
    setMessage(response.ok ? "Decisão registrada e encaminhamento notificado." : result.error?.message ?? "Não foi possível registrar a decisão.");
    if (response.ok) onSaved();
  }

  return (
    <section className="rounded-xl border border-slate-200 p-5">
      <h3 className="font-black text-slate-900">Decisão empresarial</h3>
      {analysis.decision && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-[9px] font-black uppercase tracking-wide text-emerald-700">Última decisão registrada</p>
          <h4 className="mt-1 font-black text-emerald-950">{humanize(analysis.decision.decision)}</h4>
          <p className="mt-2 text-sm leading-6 text-emerald-900">{analysis.decision.justification}</p>
          <p className="mt-2 text-[10px] text-emerald-700">{new Date(analysis.decision.decidedAt).toLocaleString("pt-BR")}</p>
        </div>
      )}
      {hasCriticalContext && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs leading-5 text-red-900"><strong>Decisão protegida:</strong> existe recomendação negativa ou impedimento crítico aberto. Somente o proprietário pode decidir prosseguir; os demais perfis podem registrar “Não prosseguir”.</p>}
      <form className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-5" onSubmit={submit}>
        <label className="grid gap-1 text-xs font-bold text-slate-700">Encaminhamento
          <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal" defaultValue={hasCriticalContext && !isOwner ? "DO_NOT_PROCEED" : "PROCEED_WITH_RESTRICTIONS"} name="decision">
            {(!hasCriticalContext || isOwner) && <option value="PROCEED">Prosseguir</option>}
            {(!hasCriticalContext || isOwner) && <option value="PROCEED_WITH_RESTRICTIONS">Prosseguir com restrições</option>}
            <option value="DO_NOT_PROCEED">Não prosseguir</option>
          </select>
        </label>
        <label className="mt-4 grid gap-1 text-xs font-bold text-slate-700">Justificativa empresarial
          <textarea className="min-h-28 rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal" maxLength={2000} minLength={20} name="justification" placeholder="Registre os fundamentos, restrições e próximos passos da decisão." required/>
        </label>
        <button className="mt-4 rounded-lg bg-brand px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50" disabled={busy} type="submit">{busy ? "Registrando…" : "Registrar decisão"}</button>
        {message && <p aria-live="polite" className="mt-3 text-xs font-semibold text-slate-700" role="status">{message}</p>}
      </form>
    </section>
  );
}

function LogisticsTab({ analysis, bases, canCalculate, busy, contextDefaults, message, onSubmit }: { analysis: IntelligenceAnalysisView; bases: readonly OperationalBaseOption[]; canCalculate: boolean; busy: boolean; contextDefaults: AnalysisContextDefaults; message: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const route = analysis.route;
  const best = route?.alternatives.filter((item) => item.condition === "ROUTE_EXISTS").sort((left, right) => (left.distanceKm ?? Infinity) - (right.distanceKm ?? Infinity))[0];
  const [selectedBaseId, setSelectedBaseId] = useState<string | undefined>(undefined);
  const selected = route?.alternatives.find((item) => item.baseId === selectedBaseId && item.condition === "ROUTE_EXISTS") ?? best;
  const mapUrl = route && selected ? buildMapsUrl(route, selected) : undefined;
  const routeDefaults: AnalysisContextDefaults = route
    ? { ...contextDefaults, locationLabel: route.destinationLabel, latitude: route.destinationLat, longitude: route.destinationLng }
    : contextDefaults;
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        {route ? (
          <>
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              <div className="relative grid min-h-[420px] place-items-center">
                {mapUrl ? <Image alt={`Rota da base ${selected?.baseName} para ${route.destinationLabel}`} className="object-cover" fill sizes="(max-width: 1024px) 100vw, 66vw" src={mapUrl} unoptimized/> : <div className="px-6 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-brand shadow"><GsIcon name="target"/></span><h3 className="mt-4 font-black text-slate-900">{route.destinationLabel}</h3><p className="mt-2 max-w-md text-xs leading-5 text-slate-500">Nenhuma rota válida foi retornada para exibição no Azure Maps.</p></div>}
              </div>
            </section>
            <section className="rounded-xl border border-slate-200">
              <header className="border-b border-slate-100 px-4 py-3">
                <h3 className="font-black text-slate-900">Rota calculada</h3>
                <p className="mt-1 text-xs text-slate-500"><span className="font-bold text-slate-700">Chegada:</span> {route.destinationLabel}</p>
              </header>
              <div className="divide-y divide-slate-100">
                {route.alternatives.map((item) => (
                  <article className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-center" key={item.baseId}>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Partida</p>
                      <p className="font-bold text-slate-900">{item.baseCode} · {item.baseName}</p>
                      <p className="text-xs text-slate-500">{item.baseLocality}</p>
                    </div>
                    <MiniMetric label="Distância" value={item.distanceKm === undefined ? "Sem rota" : `${item.distanceKm.toLocaleString("pt-BR")} km`}/>
                    <MiniMetric label="Duração" value={item.durationHours === undefined ? "—" : `${item.durationHours.toLocaleString("pt-BR")} h`}/>
                    <MiniMetric label="Pedágios" value={formatRouteTolls(item.tolls)}/>
                    {item.condition === "ROUTE_EXISTS" ? <button aria-label={`Ver rota da base ${item.baseName} no mapa acima`} className="text-xs font-bold text-brand hover:underline" onClick={() => setSelectedBaseId(item.baseId)} type="button">Visualizar</button> : <span className="text-xs text-slate-400">Sem rota</span>}
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : <EmptyDetail text="Ainda não há estudo logístico. Selecione uma base operacional e informe o local da obra ao lado."/>}
      </div>
      <div className="space-y-3">
        {message && <p aria-live="polite" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-semibold leading-5 text-blue-900" role="status">{message}</p>}
        {canCalculate && <ContextForm bases={bases} busy={busy} buttonLabel="Calcular rota" defaultBaseId={route?.selectedBaseId} defaults={routeDefaults} onSubmit={onSubmit}/>}
      </div>
    </div>
  );
}

function ClimateTab({ analysis, canCalculate, busy, contextDefaults, message, onSubmit }: { analysis: IntelligenceAnalysisView; canCalculate: boolean; busy: boolean; contextDefaults: AnalysisContextDefaults; message: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const climate = analysis.climate;
  const max = Math.max(1, ...(climate?.monthlySeries.map((item) => item.precipitationMm) ?? [1]));
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        {climate ? (
          <>
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
            <section aria-labelledby="precipitation-chart-title" className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-black text-slate-900" id="precipitation-chart-title">Precipitação histórica mensal</h3>
              <div aria-hidden="true" className="mt-6 flex h-72 items-end gap-1.5 border-b border-slate-200 px-1">
                {monthLabels.map((label, index) => {
                  const item = climate.monthlySeries.find((entry) => entry.month === index + 1);
                  const height = item ? Math.max(4, item.precipitationMm / max * 100) : 0;
                  return (
                    <div className="flex h-full min-w-0 flex-1 flex-col justify-end text-center" key={label}>
                      <span className="mb-1 text-[8px] font-bold text-slate-500">{item ? Math.round(item.precipitationMm) : "—"}</span>
                      <span className="mx-auto w-full max-w-10 rounded-t bg-gradient-to-t from-blue-700 to-blue-400" style={{ height: `${height}%` }}/>
                      <span className="mt-2 text-[8px] font-bold text-slate-500">{label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <caption className="sr-only">Tabela equivalente ao gráfico de precipitação mensal</caption>
                  <thead className="bg-slate-50 text-[9px] uppercase text-slate-500"><tr><th className="px-3 py-2">Mês</th><th className="px-3 py-2">Precipitação</th><th className="px-3 py-2">Temperatura</th><th className="px-3 py-2">Completude</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {climate.monthlySeries.map((item) => (
                      <tr key={item.month}>
                        <td className="px-3 py-2 font-bold">{monthLabels[item.month - 1]}</td>
                        <td className="px-3 py-2">{item.precipitationMm.toLocaleString("pt-BR")} mm</td>
                        <td className="px-3 py-2">{item.averageTemperatureC === undefined ? "—" : `${item.averageTemperatureC.toLocaleString("pt-BR")} °C`}</td>
                        <td className="px-3 py-2">{Math.round(item.completeness)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : <EmptyDetail text="Ainda não há estudo climático para esta oportunidade. A ausência de dados não é convertida em clima favorável ou nota zero."/>}
      </div>
      <div className="space-y-3">
        {message && <p aria-live="polite" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-semibold leading-5 text-blue-900" role="status">{message}</p>}
        {canCalculate && <ContextForm busy={busy} buttonLabel="Consultar API climática" defaults={contextDefaults} onSubmit={onSubmit} showDates/>}
      </div>
    </div>
  );
}

function FinancialTab({ analysis, canCalculate, canReadFinancial, canAssessFinancial, canAssessClientRisk, financialSubject, opportunityId, busy, onRun }: { analysis: IntelligenceAnalysisView; canCalculate: boolean; canReadFinancial: boolean; canAssessFinancial: boolean; canAssessClientRisk: boolean; financialSubject?: FinancialSubject; opportunityId: string; busy: boolean; onRun: () => void }) {
  const financial = analysis.financial;
  return (
    <div className="space-y-5">
      {financial ? (
        <section className="rounded-xl border border-slate-200 p-5">
          <h3 className="font-black text-slate-900">Conclusão consolidada</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">{financial.summary}</p>
          {canReadFinancial ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <RiskFlag active={financial.highIndebtednessRisk === true} label="Alto risco de endividamento"/>
              <RiskFlag active={financial.nonPayingCustomer === true} label="Cliente classificado como não pagador"/>
            </div>
          ) : <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Os indicadores detalhados exigem permissão financeira específica. O resumo seguro permanece disponível.</p>}
        </section>
      ) : <EmptyDetail text="Não há avaliação financeira consolidada. Dados ausentes não geram reprovação automática."/>}
      <FinancialAssessmentManager canAssessClientRisk={canAssessClientRisk} canAssessFinancial={canAssessFinancial} canRead={canReadFinancial} opportunityId={opportunityId} subject={financialSubject}/>
      {canCalculate && <button className="rounded-lg bg-brand px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50" disabled={busy} onClick={onRun} type="button">{busy ? "Consolidando…" : "Consolidar avaliação financeira"}</button>}
    </div>
  );
}

function ContextForm({ bases, busy, buttonLabel, defaultBaseId, defaults, onSubmit, showDates = false }: { bases?: readonly OperationalBaseOption[]; busy: boolean; buttonLabel: string; defaultBaseId?: string; defaults: AnalysisContextDefaults; onSubmit: (event: FormEvent<HTMLFormElement>) => void; showDates?: boolean }) {
  const [locationLabel, setLocationLabel] = useState<string>(defaults.locationLabel ?? "");
  const [latitude, setLatitude] = useState<string>(defaults.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState<string>(defaults.longitude?.toString() ?? "");
  const [searching, setSearching] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");

  async function locateAddress() {
    if (locationLabel.trim().length < 2) {
      setLocationMessage("Informe ao menos a cidade e o estado.");
      return undefined;
    }
    setSearching(true);
    setLocationMessage("Localizando endereço…");
    const response = await fetch(`/api/geocoding?address=${encodeURIComponent(locationLabel)}`);
    const result = await response.json().catch(() => ({})) as {
      data?: { formattedAddress: string; latitude: number; longitude: number; precision: string };
      error?: { message?: string };
    };
    setSearching(false);
    if (!response.ok || !result.data) {
      setLocationMessage(result.error?.message ?? "Não foi possível localizar o endereço.");
      return undefined;
    }
    setLocationLabel(result.data.formattedAddress);
    setLatitude(result.data.latitude.toFixed(7));
    setLongitude(result.data.longitude.toFixed(7));
    setLocationMessage(`Local confirmado: ${result.data.formattedAddress}.`);
    return { latitude: result.data.latitude, longitude: result.data.longitude };
  }

  // Digitar a cidade e mandar consultar direto (sem clicar em "Localizar" antes) é o
  // caminho mais natural para quem usa a tela — e antes disso o envio falhava calado,
  // sem chamar a API e sem avisar nada. Agora localizamos o endereço aqui mesmo, se
  // ainda não tiver coordenadas, antes de enviar.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!latitude || !longitude) {
      const resolved = await locateAddress();
      if (!resolved) return;
      (form.elements.namedItem("latitude") as HTMLInputElement).value = resolved.latitude.toFixed(7);
      (form.elements.namedItem("longitude") as HTMLInputElement).value = resolved.longitude.toFixed(7);
    }
    onSubmit(event);
  }

  return <form className="rounded-xl border border-slate-200 bg-slate-50 p-5" onSubmit={handleSubmit}><h3 className="font-black text-slate-900">{bases ? "Origem e destino" : "Local da obra"}</h3><p className="mt-1 text-xs text-slate-500">{defaults.sources.length > 0 ? `Sugestão encontrada nos documentos desta oportunidade: ${defaults.sources.join(", ")}. Confirme o local antes da consulta.` : "Pesquise pela cidade ou pelo endereço informado no edital."}</p><div className="mt-4 grid gap-3">{bases && <label className="grid gap-1 text-xs font-bold text-slate-700">Endereço de partida<select className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal text-slate-800" defaultValue={defaultBaseId ?? analysisBaseId(bases)} disabled={bases.length === 0} name="routeBaseId" required><option disabled value="">{bases.length === 0 ? "Cadastre uma base operacional no Administrador" : "Selecione a Matriz ou Filial"}</option>{bases.map((base) => <option key={base.id} value={base.id}>{base.code} · {base.name} — {base.locality}</option>)}</select></label>}<label className="grid gap-1 text-xs font-bold text-slate-700">Cidade ou endereço da obra<div className="flex flex-col gap-2"><input className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal" maxLength={500} name="locationLabel" onChange={(event) => { setLocationLabel(event.target.value); setLatitude(""); setLongitude(""); setLocationMessage(""); }} placeholder="Ex.: Gravataí/RS ou endereço completo do edital" required value={locationLabel}/><button className="shrink-0 rounded-lg border border-brand bg-white px-4 py-2 text-xs font-bold text-brand disabled:opacity-50" disabled={searching} onClick={locateAddress} type="button">{searching ? "Localizando…" : "Localizar"}</button></div></label>{locationMessage && <p aria-live="polite" className="text-xs font-semibold text-slate-600" role="status">{locationMessage}</p>}<details className="rounded-lg border border-slate-200 bg-white"><summary className="cursor-pointer px-3 py-2 text-xs font-bold text-slate-700">Localização avançada · latitude e longitude</summary><div className="grid gap-3 border-t border-slate-100 p-3"><label className="grid gap-1 text-xs font-bold text-slate-700">Latitude<input className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal" max="90" min="-90" name="latitude" onChange={(event) => setLatitude(event.target.value)} placeholder="-29.9448" step="any" type="number" value={latitude}/></label><label className="grid gap-1 text-xs font-bold text-slate-700">Longitude<input className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal" max="180" min="-180" name="longitude" onChange={(event) => setLongitude(event.target.value)} placeholder="-50.9919" step="any" type="number" value={longitude}/></label><p className="text-[10px] leading-4 text-slate-500">Use somente quando a busca por cidade/endereço não oferecer precisão suficiente.</p></div></details>{showDates && <><label className="grid gap-1 text-xs font-bold text-slate-700">Início previsto<input className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal" defaultValue={defaults.workStart} name="workStart" required type="date"/></label><label className="grid gap-1 text-xs font-bold text-slate-700">Fim previsto<input className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal" defaultValue={defaults.workEnd} name="workEnd" required type="date"/></label></>}</div><button className="mt-4 w-full rounded-lg bg-brand px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50" disabled={busy || searching || Boolean(bases && bases.length === 0)}>{busy ? "Processando…" : buttonLabel}</button></form>;
}

function analysisBaseId(bases: readonly OperationalBaseOption[]): string {
  return bases.length === 1 ? bases[0]!.id : "";
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-xs font-black text-slate-800">{value}</p></div>;
}

function RiskFlag({ active, label }: { active: boolean; label: string }) {
  return <div className={`rounded-xl border p-4 ${active ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}><p className={`text-xs font-black ${active ? "text-red-800" : "text-emerald-800"}`}>{active ? "Atenção crítica" : "Não identificado"}</p><p className={`mt-1 text-xs ${active ? "text-red-700" : "text-emerald-700"}`}>{label}</p></div>;
}

function EmptyDetail({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center"><p className="text-sm leading-6 text-slate-500">{text}</p></div>;
}
