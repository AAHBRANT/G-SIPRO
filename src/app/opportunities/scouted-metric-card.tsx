import Link from "next/link";

import { GsIcon } from "@/components/ui/gs-icon";

/**
 * Card das licitações captadas pelo Buscador. Segue o padrão visual do
 * MetricCard executivo, com duas diferenças necessárias: é clicável — leva à
 * fila de triagem — e assume estado de alerta enquanto houver licitação sem
 * decisão da equipe.
 *
 * Permanece visível mesmo com zero pendências: a ausência de resultado também é
 * informação, e mostra que a varredura ocorreu.
 */
export function ScoutedMetricCard({ value }: { value: number }) {
  const pending = value > 0;

  return (
    <Link
      className={`relative block min-h-32 overflow-hidden rounded-xl border p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 ${
        pending
          ? "border-red-200 bg-red-50/60 hover:shadow-[0_8px_24px_rgba(190,18,60,0.12)]"
          : "border-slate-200/90 bg-white hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
      }`}
      href="/opportunities/scouted"
    >
      <span className="absolute inset-y-0 left-0 w-[3px] bg-brand" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-xs font-bold ${pending ? "text-brand" : "text-slate-600"}`}>Oportunidades Rastreadas</p>
          <p className={`mt-2 flex items-center gap-2 text-[30px] font-black leading-none tracking-[-0.035em] ${pending ? "text-brand" : "text-slate-950"}`}>
            {value}
            {pending && <span className="rounded-full bg-brand px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white">Novas</span>}
          </p>
        </div>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${pending ? "bg-red-100 text-brand" : "bg-slate-100 text-slate-700"}`}>
          <GsIcon className="h-4 w-4" name="search" />
        </span>
      </div>
      <p className={`mt-4 text-xs leading-5 ${pending ? "text-red-900/80" : "text-slate-500"}`}>
        {pending ? "Captadas pelo Buscador, aguardando triagem" : "Nenhuma licitação aguardando triagem"}
      </p>
    </Link>
  );
}
