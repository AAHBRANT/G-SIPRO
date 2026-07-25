"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { GsIcon } from "@/components/ui/gs-icon";

type Perspective = "ALL" | "COMMERCIAL" | "TECHNICAL" | "STUDIES";
type DrawerKind = "COMMERCIAL" | "TECHNICAL" | "CLIMATE" | "LOGISTICS" | "FINANCIAL" | "PENDING" | null;

export type IntelligenceDimensionView = Readonly<{
  id: string;
  perspective: Exclude<Perspective, "ALL">;
  code: string;
  status: string;
  score: number | null;
  confidence: number;
  summary: string;
  risks: readonly string[];
  pendingCount: number;
  evidenceCount: number;
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
}>;

export type RouteView = Readonly<{
  destinationLabel: string;
  destinationLat: number;
  destinationLng: number;
  provider: string;
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
  climate?: ClimateView;
  route?: RouteView;
}>;

export type IntegrationReadinessView = Readonly<{
  code: string;
  label: string;
  status: "READY" | "OWNER_ACTION_REQUIRED";
  missingConfiguration: readonly string[];
  nextAction: string;
  responsible: "PROPRIETARIO" | "ADMINISTRADOR_CLOUD";
}>;

const perspectiveLabels: Record<Perspective, string> = {
  ALL: "Visão consolidada",
  COMMERCIAL: "Comercial",
  TECHNICAL: "Capacidade técnica",
  STUDIES: "Estudos e praticabilidade",
};

const recommendationLabels: Record<string, string> = {
  RECOMMENDED: "Recomendado",
  RECOMMENDED_WITH_RESERVATIONS: "Recomendado com ressalvas",
  NOT_RECOMMENDED: "Não recomendado",
  WAITING_INFORMATION: "Aguardando informações",
  WAITING_OWNER_DECISION: "Aguardando decisão",
};

const recommendationTone: Record<string, string> = {
  RECOMMENDED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  RECOMMENDED_WITH_RESERVATIONS: "border-amber-200 bg-amber-50 text-amber-800",
  NOT_RECOMMENDED: "border-red-200 bg-red-50 text-red-800",
  WAITING_INFORMATION: "border-blue-200 bg-blue-50 text-blue-800",
  WAITING_OWNER_DECISION: "border-violet-200 bg-violet-50 text-violet-800",
};

const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatPercent(value: number | null) {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function scoreTone(value: number | null) {
  if (value === null) return "text-slate-500";
  if (value >= 75) return "text-emerald-700";
  if (value >= 50) return "text-amber-700";
  return "text-red-700";
}

function buildMapsUrl(route: RouteView, alternative?: RouteAlternativeView) {
  const destination = `${route.destinationLat},${route.destinationLng}`;
  if (!alternative) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
  const origin = `${alternative.origin.latitude},${alternative.origin.longitude}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

export function IntelligencePanel({
  opportunityId,
  opportunityCode,
  analysis,
  canCalculate,
  canReadFinancial,
  mapsEmbedKey,
  integrationReadiness,
}: {
  opportunityId: string;
  opportunityCode: string;
  analysis: IntelligenceAnalysisView | null;
  canCalculate: boolean;
  canReadFinancial: boolean;
  mapsEmbedKey?: string;
  integrationReadiness?: readonly IntegrationReadinessView[];
}) {
  const router = useRouter();
  const [perspective, setPerspective] = useState<Perspective>("ALL");
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [busyStage, setBusyStage] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!drawer) return;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawer(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [drawer]);

  const visibleDimensions = useMemo(
    () => analysis?.dimensions.filter((item) => perspective === "ALL" || item.perspective === perspective) ?? [],
    [analysis, perspective],
  );

  async function runStage(stage: "COMMERCIAL" | "TECHNICAL" | "FINANCIAL", payload: Record<string, unknown> = {}) {
    setBusyStage(stage);
    const stageLabel = stage === "FINANCIAL" ? "avaliação financeira" : perspectiveLabels[stage];
    setMessage(`Executando ${stageLabel}…`);
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
    setMessage(response.ok ? "Análise concluída e versionada." : result.error?.message ?? "Não foi possível executar a análise.");
    if (response.ok) router.refresh();
  }

  async function runContextualStage(
    event: FormEvent<HTMLFormElement>,
    stage: "CLIMATE" | "LOGISTICS",
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = stage === "CLIMATE"
      ? {
          climateContext: {
            locationLabel: form.get("locationLabel"),
            latitude: Number(form.get("latitude")),
            longitude: Number(form.get("longitude")),
            workStart: form.get("workStart"),
            workEnd: form.get("workEnd"),
          },
        }
      : {
          routeDestination: {
            label: form.get("locationLabel"),
            latitude: Number(form.get("latitude")),
            longitude: Number(form.get("longitude")),
            travelMode: "DRIVE",
          },
        };
    setBusyStage(stage);
    setMessage(stage === "CLIMATE" ? "Consultando dados climáticos autorizados…" : "Calculando rotas das bases operacionais…");
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
    if (response.ok) {
      setDrawer(null);
      router.refresh();
    }
  }

  return (
    <section aria-labelledby="intelligence-title" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
      <header className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-5 py-6 text-white sm:px-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-300">Inteligência de decisão</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight" id="intelligence-title">Modo Analítico Inteligente</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Consolida atratividade comercial, capacidade operacional, praticabilidade, logística e risco para apoiar a decisão sobre a oportunidade {opportunityCode}.
            </p>
          </div>
          {canCalculate && (
            <div className="flex flex-wrap gap-2">
              <button className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-slate-900 transition hover:bg-slate-100 disabled:opacity-50" disabled={Boolean(busyStage)} onClick={() => runStage("COMMERCIAL")} type="button">
                {busyStage === "COMMERCIAL" ? "Analisando…" : analysis ? "Atualizar comercial" : "Iniciar análise"}
              </button>
              <button className="rounded-lg border border-white/20 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/10 disabled:opacity-50" disabled={Boolean(busyStage)} onClick={() => runStage("TECHNICAL")} type="button">
                Capacidade operacional
              </button>
            </div>
          )}
        </div>
        {message && <p aria-live="polite" className="mt-4 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white" role="status">{message}</p>}
      </header>

      {!analysis ? (
        <div className="grid min-h-64 place-items-center px-6 py-12 text-center">
          <div className="max-w-lg">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-600"><GsIcon name="chart"/></span>
            <h3 className="mt-4 text-lg font-black text-slate-900">Nenhuma análise executada</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">Inicie pela avaliação comercial. Cada nova etapa gera uma versão rastreável sem alterar os dados originais da oportunidade.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
              <div className={`inline-flex w-fit items-center rounded-full border px-3 py-1.5 text-xs font-black ${recommendationTone[analysis.recommendation ?? ""] ?? "border-slate-200 bg-slate-50 text-slate-700"}`}>
                {recommendationLabels[analysis.recommendation ?? ""] ?? humanize(analysis.recommendation ?? analysis.status)}
              </div>
              <p className="max-w-4xl text-sm leading-6 text-slate-600">{analysis.executiveSummary ?? "A versão atual ainda não possui resumo executivo."}</p>
              <div className="ml-auto whitespace-nowrap text-[10px] text-slate-400">
                Versão {analysis.version} · Política {analysis.policy.name} v{analysis.policy.version}
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-b border-slate-100 bg-slate-50/60 p-5 sm:grid-cols-2 lg:grid-cols-5 sm:px-7">
            <ExecutiveMetric label="Pontuação" value={analysis.score === null ? "—" : analysis.score.toFixed(0)} detail="Resultado ponderado" tone={scoreTone(analysis.score)}/>
            <ExecutiveMetric label="Cobertura" value={formatPercent(analysis.coverage)} detail="Dados calculáveis"/>
            <ExecutiveMetric label="Confiança" value={formatPercent(analysis.confidence)} detail="Qualidade das evidências"/>
            <button className="text-left" onClick={() => setDrawer("PENDING")} type="button"><ExecutiveMetric label="Pendências" value={analysis.pendingItems.filter((item) => item.status === "OPEN").length.toString()} detail="Informações necessárias" interactive/></button>
            <ExecutiveMetric label="Impedimentos" value={analysis.impediments.filter((item) => item.status === "OPEN").length.toString()} detail="Exigem atenção crítica" tone={analysis.impediments.some((item) => item.status === "OPEN") ? "text-red-700" : "text-emerald-700"}/>
          </div>

          <nav aria-label="Perspectivas da análise" className="flex gap-1 overflow-x-auto border-b border-slate-100 px-5 pt-4 sm:px-7">
            {(Object.keys(perspectiveLabels) as Perspective[]).map((item) => (
              <button aria-current={perspective === item ? "page" : undefined} className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs font-bold transition ${perspective === item ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-slate-900"}`} key={item} onClick={() => setPerspective(item)} type="button">
                {perspectiveLabels[item]}
              </button>
            ))}
          </nav>

          <div className="grid gap-4 p-5 lg:grid-cols-3 sm:p-7">
            {visibleDimensions.map((dimension) => (
              <button className="group rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" key={dimension.id} onClick={() => setDrawer(dimension.perspective === "COMMERCIAL" ? "COMMERCIAL" : dimension.perspective === "TECHNICAL" ? "TECHNICAL" : "CLIMATE")} type="button">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-700"><GsIcon className="h-4 w-4" name={dimension.perspective === "COMMERCIAL" ? "money" : dimension.perspective === "TECHNICAL" ? "target" : "chart"}/></span>
                  <span className={`text-2xl font-black ${scoreTone(dimension.score)}`}>{dimension.score === null ? "—" : dimension.score.toFixed(0)}</span>
                </div>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{perspectiveLabels[dimension.perspective]}</p>
                <h3 className="mt-1 font-black text-slate-900">{humanize(dimension.code)}</h3>
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">{dimension.summary}</p>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] font-semibold text-slate-500">
                  <span>{dimension.evidenceCount} evidência(s)</span><span>{dimension.pendingCount} pendência(s)</span><GsIcon className="h-3.5 w-3.5 text-brand transition group-hover:translate-x-0.5" name="arrow"/>
                </div>
              </button>
            ))}

            {(perspective === "ALL" || perspective === "STUDIES") && (
              <>
                <FeatureCard description={analysis.climate ? `${analysis.climate.locationLabel} · cobertura ${Math.round(analysis.climate.dataCoverage)}%` : "Informe o local e o período previsto para consultar a API."} icon="chart" label="Período chuvoso" onOpen={() => setDrawer("CLIMATE")} status={analysis.climate ? "Estudo disponível" : "Aguardando estudo"}/>
                <FeatureCard description={analysis.route ? `${analysis.route.alternatives.length} alternativa(s) de mobilização calculada(s).` : "Compare distância, tempo e rota entre as bases e a obra."} icon="target" label="Logística e distância" onOpen={() => setDrawer("LOGISTICS")} status={analysis.route ? "Rotas disponíveis" : "Aguardando estudo"}/>
              </>
            )}
            {(perspective === "ALL" || perspective === "COMMERCIAL") && (
              <FeatureCard description={analysis.financial?.summary ?? "Cruze os índices autorizados e o desempenho formal de pagamento."} icon="money" label="Capacidade financeira e cliente" onOpen={() => setDrawer("FINANCIAL")} status={analysis.financial ? "Avaliação disponível" : "Aguardando avaliação"}/>
            )}
          </div>
        </>
      )}

      {integrationReadiness && (
        <section className="border-t border-slate-100 bg-slate-50/70 px-5 py-5 sm:px-7">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-brand">Prontidão do ambiente</p>
              <h3 className="mt-1 font-black text-slate-900">Integrações externas</h3>
            </div>
            <p className="text-[10px] text-slate-500">A verificação nunca exibe chaves, tokens ou segredos.</p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {integrationReadiness.map((item) => (
              <article className="rounded-xl border border-slate-200 bg-white p-4" key={item.code}>
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-xs font-black text-slate-900">{item.label}</h4>
                  <span className={`rounded-full px-2 py-1 text-[8px] font-black ${item.status === "READY" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {item.status === "READY" ? "Pronto" : "Ação necessária"}
                  </span>
                </div>
                <p className="mt-3 text-[10px] leading-4 text-slate-500">{item.nextAction}</p>
                {item.missingConfiguration.length > 0 && <p className="mt-3 border-t border-slate-100 pt-2 text-[9px] text-slate-400">Responsável: {item.responsible === "PROPRIETARIO" ? "Proprietário" : "Administrador cloud"}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      {drawer && (
        <IntelligenceDrawer title={drawerTitle(drawer)} onClose={() => setDrawer(null)} closeButtonRef={closeButtonRef}>
          {drawer === "CLIMATE" && <ClimateDetail analysis={analysis} busy={busyStage === "CLIMATE"} canCalculate={canCalculate} onSubmit={(event) => runContextualStage(event, "CLIMATE")}/>}
          {drawer === "LOGISTICS" && <LogisticsDetail analysis={analysis} busy={busyStage === "LOGISTICS"} canCalculate={canCalculate} mapsEmbedKey={mapsEmbedKey} onSubmit={(event) => runContextualStage(event, "LOGISTICS")}/>}
          {drawer === "FINANCIAL" && <FinancialDetail analysis={analysis} busy={busyStage === "FINANCIAL"} canCalculate={canCalculate} canReadFinancial={canReadFinancial} onRun={() => runStage("FINANCIAL")}/>}
          {(drawer === "COMMERCIAL" || drawer === "TECHNICAL") && <DimensionDetail analysis={analysis} perspective={drawer}/>}
          {drawer === "PENDING" && <PendingDetail analysis={analysis}/>}
        </IntelligenceDrawer>
      )}
    </section>
  );
}

function ExecutiveMetric({ label, value, detail, tone = "text-slate-950", interactive = false }: { label: string; value: string; detail: string; tone?: string; interactive?: boolean }) {
  return <article className={`h-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${interactive ? "transition hover:border-brand hover:shadow-md" : ""}`}><p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p><p className={`mt-2 text-3xl font-black tracking-tight ${tone}`}>{value}</p><p className="mt-1 text-[10px] text-slate-500">{detail}</p></article>;
}

function FeatureCard({ icon, label, description, status, onOpen }: { icon: "chart" | "target" | "money"; label: string; description: string; status: string; onOpen: () => void }) {
  return <button className="group rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-5 text-left transition hover:border-brand hover:bg-blue-50/30" onClick={onOpen} type="button"><div className="flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-brand shadow-sm"><GsIcon className="h-4 w-4" name={icon}/></span><span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold text-slate-500">{status}</span></div><h3 className="mt-4 font-black text-slate-900">{label}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{description}</p><span className="mt-4 inline-flex items-center gap-1 text-[10px] font-bold text-brand">Ver detalhes <GsIcon className="h-3 w-3 transition group-hover:translate-x-0.5" name="arrow"/></span></button>;
}

function drawerTitle(drawer: Exclude<DrawerKind, null>) {
  return {
    COMMERCIAL: "Atratividade comercial",
    TECHNICAL: "Capacidade técnica e operacional",
    CLIMATE: "Período chuvoso e praticabilidade",
    LOGISTICS: "Logística, distância e rota",
    FINANCIAL: "Capacidade financeira e cliente",
    PENDING: "Pendências da análise",
  }[drawer];
}

function IntelligenceDrawer({ title, children, onClose, closeButtonRef }: { title: string; children: React.ReactNode; onClose: () => void; closeButtonRef: React.RefObject<HTMLButtonElement | null> }) {
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }} role="presentation"><aside aria-labelledby="analysis-drawer-title" aria-modal="true" className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl" role="dialog"><header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur"><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-brand">Detalhamento analítico</p><h2 className="mt-1 text-lg font-black text-slate-950" id="analysis-drawer-title">{title}</h2></div><button aria-label="Fechar detalhamento" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-lg text-slate-600 hover:bg-slate-50" onClick={onClose} ref={closeButtonRef} type="button">×</button></header><div className="p-5 sm:p-6">{children}</div></aside></div>;
}

function DimensionDetail({ analysis, perspective }: { analysis: IntelligenceAnalysisView | null; perspective: "COMMERCIAL" | "TECHNICAL" }) {
  const dimensions = analysis?.dimensions.filter((item) => item.perspective === perspective) ?? [];
  if (!dimensions.length) return <EmptyDetail text="Esta perspectiva ainda não possui resultado. Execute a etapa correspondente para gerar a avaliação."/>;
  return <div className="space-y-4">{dimensions.map((item) => <article className="rounded-xl border border-slate-200 p-5" key={item.id}><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{humanize(item.status)}</p><h3 className="mt-1 font-black text-slate-900">{humanize(item.code)}</h3></div><span className={`text-3xl font-black ${scoreTone(item.score)}`}>{item.score === null ? "—" : item.score.toFixed(0)}</span></div><p className="mt-3 text-sm leading-6 text-slate-600">{item.summary}</p><div className="mt-4 grid grid-cols-3 gap-2 text-center"><MiniMetric label="Confiança" value={formatPercent(item.confidence)}/><MiniMetric label="Evidências" value={String(item.evidenceCount)}/><MiniMetric label="Pendências" value={String(item.pendingCount)}/></div>{item.risks.length > 0 && <div className="mt-4 rounded-lg bg-amber-50 p-3"><p className="text-[10px] font-black uppercase text-amber-800">Pontos de atenção</p><ul className="mt-2 space-y-1 text-xs leading-5 text-amber-900">{item.risks.map((risk) => <li key={risk}>• {risk}</li>)}</ul></div>}</article>)}</div>;
}

function ClimateDetail({ analysis, canCalculate, busy, onSubmit }: { analysis: IntelligenceAnalysisView | null; canCalculate: boolean; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const climate = analysis?.climate;
  const max = Math.max(1, ...(climate?.monthlySeries.map((item) => item.precipitationMm) ?? [1]));
  return <div className="space-y-6">{climate ? <><section className="rounded-xl border border-slate-200 p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-black text-slate-900">{climate.locationLabel}</h3><p className="mt-1 text-xs text-slate-500">{climate.provider} · histórico de {new Date(climate.historyStart).toLocaleDateString("pt-BR")} a {new Date(climate.historyEnd).toLocaleDateString("pt-BR")}</p></div><span className="h-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">Cobertura {Math.round(climate.dataCoverage)}%</span></div><p className="mt-3 text-xs text-slate-500">Período previsto da obra: {new Date(climate.workStart).toLocaleDateString("pt-BR")} a {new Date(climate.workEnd).toLocaleDateString("pt-BR")}</p></section><section aria-labelledby="precipitation-chart-title" className="rounded-xl border border-slate-200 p-5"><h3 className="font-black text-slate-900" id="precipitation-chart-title">Precipitação histórica mensal</h3><div aria-hidden="true" className="mt-6 flex h-56 items-end gap-1.5 border-b border-slate-200 px-1">{monthLabels.map((label, index) => { const item = climate.monthlySeries.find((entry) => entry.month === index + 1); const height = item ? Math.max(4, item.precipitationMm / max * 100) : 0; return <div className="flex h-full min-w-0 flex-1 flex-col justify-end text-center" key={label}><span className="mb-1 text-[8px] font-bold text-slate-500">{item ? Math.round(item.precipitationMm) : "—"}</span><span className="mx-auto w-full max-w-7 rounded-t bg-gradient-to-t from-blue-700 to-blue-400" style={{ height: `${height}%` }}/><span className="mt-2 text-[8px] font-bold text-slate-500">{label}</span></div>; })}</div><div className="mt-5 overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">Tabela equivalente ao gráfico de precipitação mensal</caption><thead className="bg-slate-50 text-[9px] uppercase text-slate-500"><tr><th className="px-3 py-2">Mês</th><th className="px-3 py-2">Precipitação</th><th className="px-3 py-2">Temperatura</th><th className="px-3 py-2">Completude</th></tr></thead><tbody className="divide-y divide-slate-100">{climate.monthlySeries.map((item) => <tr key={item.month}><td className="px-3 py-2 font-bold">{monthLabels[item.month - 1]}</td><td className="px-3 py-2">{item.precipitationMm.toLocaleString("pt-BR")} mm</td><td className="px-3 py-2">{item.averageTemperatureC === undefined ? "—" : `${item.averageTemperatureC.toLocaleString("pt-BR")} °C`}</td><td className="px-3 py-2">{Math.round(item.completeness)}%</td></tr>)}</tbody></table></div></section></> : <EmptyDetail text="Ainda não há estudo climático para esta oportunidade. A ausência de dados não é convertida em clima favorável ou nota zero."/>}{canCalculate && <ContextForm busy={busy} buttonLabel="Consultar API climática" onSubmit={onSubmit} showDates/>}</div>;
}

function LogisticsDetail({ analysis, canCalculate, busy, mapsEmbedKey, onSubmit }: { analysis: IntelligenceAnalysisView | null; canCalculate: boolean; busy: boolean; mapsEmbedKey?: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const route = analysis?.route;
  const best = route?.alternatives.filter((item) => item.condition === "ROUTE_EXISTS").sort((left, right) => (left.distanceKm ?? Infinity) - (right.distanceKm ?? Infinity))[0];
  const embedUrl = route && best && mapsEmbedKey ? `https://www.google.com/maps/embed/v1/directions?key=${encodeURIComponent(mapsEmbedKey)}&origin=${best.origin.latitude},${best.origin.longitude}&destination=${route.destinationLat},${route.destinationLng}&mode=driving` : undefined;
  return <div className="space-y-6">{route ? <><section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100"><div className="relative grid min-h-72 place-items-center">{embedUrl ? <iframe allowFullScreen className="h-80 w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={embedUrl} title={`Rota para ${route.destinationLabel}`}/> : <div className="px-6 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-brand shadow"><GsIcon name="target"/></span><h3 className="mt-4 font-black text-slate-900">{route.destinationLabel}</h3><p className="mt-2 max-w-md text-xs leading-5 text-slate-500">A rota foi calculada. Configure a chave de navegador restrita para exibir o mapa incorporado ou abra diretamente no Google Maps.</p>{best && <a className="mt-4 inline-flex rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white" href={buildMapsUrl(route, best)} rel="noreferrer" target="_blank">Abrir rota no Google Maps</a>}</div>}</div></section><section className="rounded-xl border border-slate-200"><header className="border-b border-slate-100 px-4 py-3"><h3 className="font-black text-slate-900">Alternativas de mobilização</h3></header><div className="divide-y divide-slate-100">{route.alternatives.map((item) => <article className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center" key={item.baseId}><div><p className="font-bold text-slate-900">{item.baseCode} · {item.baseName}</p><p className="text-xs text-slate-500">{item.baseLocality}</p></div><MiniMetric label="Distância" value={item.distanceKm === undefined ? "Sem rota" : `${item.distanceKm.toLocaleString("pt-BR")} km`}/><MiniMetric label="Duração" value={item.durationHours === undefined ? "—" : `${item.durationHours.toLocaleString("pt-BR")} h`}/><a aria-label={`Abrir rota da base ${item.baseName}`} className="text-xs font-bold text-brand hover:underline" href={buildMapsUrl(route, item)} rel="noreferrer" target="_blank">Visualizar</a></article>)}</div></section></> : <EmptyDetail text="Ainda não há estudo logístico. Cadastre pelo menos uma base operacional e informe as coordenadas do local da obra."/>}{canCalculate && <ContextForm busy={busy} buttonLabel="Calcular rotas" onSubmit={onSubmit}/>}</div>;
}

function FinancialDetail({ analysis, canCalculate, canReadFinancial, busy, onRun }: { analysis: IntelligenceAnalysisView | null; canCalculate: boolean; canReadFinancial: boolean; busy: boolean; onRun: () => void }) {
  const financial = analysis?.financial;
  return <div className="space-y-5">{financial ? <section className="rounded-xl border border-slate-200 p-5"><h3 className="font-black text-slate-900">Conclusão consolidada</h3><p className="mt-3 text-sm leading-6 text-slate-600">{financial.summary}</p>{canReadFinancial ? <div className="mt-5 grid gap-3 sm:grid-cols-2"><RiskFlag active={financial.highIndebtednessRisk === true} label="Alto risco de endividamento"/><RiskFlag active={financial.nonPayingCustomer === true} label="Cliente classificado como não pagador"/></div> : <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Os indicadores detalhados exigem permissão financeira específica. O resumo seguro permanece disponível.</p>}</section> : <EmptyDetail text="Não há avaliação financeira consolidada. Dados ausentes não geram reprovação automática."/>}{canCalculate && <button className="rounded-lg bg-brand px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50" disabled={busy} onClick={onRun} type="button">{busy ? "Analisando…" : "Executar avaliação financeira"}</button>}</div>;
}

function PendingDetail({ analysis }: { analysis: IntelligenceAnalysisView | null }) {
  const pending = analysis?.pendingItems ?? [];
  if (!pending.length) return <EmptyDetail text="A versão atual não possui pendências registradas."/>;
  return <div className="space-y-3">{pending.map((item) => <article className="rounded-xl border border-slate-200 p-4" key={item.id}><div className="flex items-start justify-between gap-3"><h3 className="font-bold text-slate-900">{item.description}</h3><span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-700">{humanize(item.status)}</span></div><p className="mt-2 text-xs leading-5 text-slate-500"><strong>Motivo:</strong> {item.reason}</p><p className="mt-2 rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-900"><strong>Informação necessária:</strong> {item.requiredInformation}</p></article>)}</div>;
}

function ContextForm({ busy, buttonLabel, onSubmit, showDates = false }: { busy: boolean; buttonLabel: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; showDates?: boolean }) {
  return <form className="rounded-xl border border-slate-200 bg-slate-50 p-5" onSubmit={onSubmit}><h3 className="font-black text-slate-900">Dados do local da obra</h3><p className="mt-1 text-xs text-slate-500">Informe dados confirmados. O sistema não presume localização ou período.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-bold text-slate-700 sm:col-span-2">Local<input className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal" maxLength={255} name="locationLabel" placeholder="Cidade/UF ou endereço da obra" required/></label><label className="grid gap-1 text-xs font-bold text-slate-700">Latitude<input className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal" max="90" min="-90" name="latitude" placeholder="-23.5505" required step="0.0000001" type="number"/></label><label className="grid gap-1 text-xs font-bold text-slate-700">Longitude<input className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal" max="180" min="-180" name="longitude" placeholder="-46.6333" required step="0.0000001" type="number"/></label>{showDates && <><label className="grid gap-1 text-xs font-bold text-slate-700">Início previsto<input className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal" name="workStart" required type="date"/></label><label className="grid gap-1 text-xs font-bold text-slate-700">Fim previsto<input className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal" name="workEnd" required type="date"/></label></>}</div><button className="mt-4 rounded-lg bg-brand px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50" disabled={busy}>{busy ? "Processando…" : buttonLabel}</button></form>;
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
