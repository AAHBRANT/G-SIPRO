"use client";

import { useEffect, useState } from "react";
import type { SupportTicketView } from "./support-center";
import { supportResolutionForecast } from "@/modules/support/domain/support-resolution-forecast";

function formatDuration(totalMinutes: number) {
  const minutes = Math.max(0, Math.abs(Math.trunc(totalMinutes)));
  const days = Math.floor(minutes / 1_440);
  const hours = Math.floor((minutes % 1_440) / 60);
  const remainder = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${remainder}min`;
  return `${remainder}min`;
}

function forecastInput(ticket: SupportTicketView) {
  return {
    status: ticket.status,
    priority: ticket.priority,
    type: ticket.type,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    executionClaimedAt: ticket.executionClaimedAt,
    executionAttempts: ticket.executionAttempts,
    resolvedAt: ticket.resolvedAt,
  };
}

export function SupportResolutionForecastCard({ ticket, compact = false }: { ticket: SupportTicketView; compact?: boolean }) {
  const [clock, setClock] = useState(() => new Date(ticket.updatedAt));
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const forecast = supportResolutionForecast(forecastInput(ticket), clock);

  if (compact) {
    if (forecast.state === "WAITING") return <div className="text-[10px] font-semibold text-amber-800"><p>{forecast.headline}</p><p className="mt-0.5 text-slate-500">{forecast.responsible}</p></div>;
    if (forecast.state === "DONE") return <div className="text-[10px] font-semibold text-emerald-700"><p>{forecast.headline}</p><p className="mt-0.5 text-slate-500">{formatDuration(forecast.elapsedMinutes)}</p></div>;
    return <div className={`text-[10px] font-semibold ${forecast.state === "OVERDUE" ? "text-rose-700" : "text-blue-700"}`}>
      <p>{forecast.estimateAt ? new Date(forecast.estimateAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Sem previsão"}</p>
      <p className="mt-0.5 text-slate-500">{forecast.state === "OVERDUE" ? `Excedida há ${formatDuration(forecast.remainingMinutes ?? 0)}` : `Restam aproximadamente ${formatDuration(forecast.remainingMinutes ?? 0)}`}</p>
    </div>;
  }

  const tone = forecast.state === "OVERDUE"
    ? "border-rose-200 bg-rose-50"
    : forecast.state === "WAITING"
      ? "border-amber-200 bg-amber-50"
      : forecast.state === "DONE"
        ? "border-emerald-200 bg-emerald-50"
        : "border-blue-200 bg-blue-50";
  return <section className={`rounded-xl border p-4 ${tone}`} aria-label="Previsão de atendimento">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-black uppercase tracking-wider text-slate-500">Previsão de atendimento</p><h4 className="mt-1 text-base font-black text-slate-950">{forecast.headline}</h4></div>
      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">{forecast.responsible}</span>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-3">
      <ForecastMetric label={forecast.state === "DONE" ? "Tempo total" : "Tempo em aberto"} value={formatDuration(forecast.elapsedMinutes)}/>
      <ForecastMetric label="Conclusão estimada" value={forecast.estimateAt ? new Date(forecast.estimateAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Aguardando ação"}/>
      <ForecastMetric label={forecast.state === "OVERDUE" ? "Atraso estimado" : "Tempo restante"} value={forecast.remainingMinutes === null ? "Pausado" : formatDuration(forecast.remainingMinutes)}/>
    </div>
    <p className="mt-3 text-xs leading-5 text-slate-600">{forecast.explanation}</p>
    <div className="mt-4 rounded-lg border border-white/80 bg-white/75 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">O que falta</p>
      <p className="mt-1 text-sm font-semibold leading-5 text-slate-800">{forecast.pendingSummary}</p>
    </div>
    {forecast.nextActions.length > 0 && <div className="mt-4">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Próximas ações</p>
      <ol className="mt-2 grid gap-2">
        {forecast.nextActions.map((action, index) => <li className="grid grid-cols-[24px_1fr] gap-2 rounded-lg border border-white/80 bg-white/75 p-3" key={`${action.label}-${index}`}>
          <span className={`flex size-6 items-center justify-center rounded-full text-[10px] font-black ${action.state === "CURRENT" ? "bg-brand text-white" : "bg-slate-100 text-slate-500"}`}>{index + 1}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-black text-slate-900">{action.label}</p>
              <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${action.state === "CURRENT" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{action.responsible}</span>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-slate-600">{action.detail}</p>
          </div>
        </li>)}
      </ol>
    </div>}
    <p className="mt-2 text-[10px] font-semibold text-slate-400">Previsão operacional, atualizada automaticamente. Não representa SLA contratual.</p>
  </section>;
}

function ForecastMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/80 bg-white/75 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-black text-slate-800">{value}</p></div>;
}
