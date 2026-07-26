import { GsIcon } from "@/components/ui/gs-icon";
import type { IntelligenceAnalysisView } from "@/app/opportunities/[id]/intelligence-panel";
import { humanize, perspectiveLabels } from "@/app/opportunities/[id]/intelligence-view-helpers";

const perspectiveIcon: Record<"COMMERCIAL" | "TECHNICAL" | "STUDIES", "money" | "target" | "chart"> = {
  COMMERCIAL: "money",
  TECHNICAL: "target",
  STUDIES: "chart",
};

/**
 * Mostra a análise do Modo Analítico Inteligente já calculada na Oportunidade de origem,
 * só para leitura — a Proposta não recalcula nada, só herda o que já foi decidido antes.
 */
export function InheritedAnalysis({ analysis, opportunityCode }: { analysis: IntelligenceAnalysisView | null; opportunityCode: string }) {
  if (!analysis) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-brand">Modo Analítico Inteligente</p>
        <h2 className="mt-1 text-xl font-bold">Análise herdada da oportunidade</h2>
        <p className="mt-4 rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-500">
          A oportunidade {opportunityCode} ainda não possui uma análise calculada.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <header className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-wider text-brand">Modo Analítico Inteligente</p>
        <h2 className="mt-1 text-xl font-bold">Análise herdada da oportunidade {opportunityCode}</h2>
        <p className="mt-1 text-sm text-muted">Calculada na fase de oportunidade e preservada aqui só para consulta — a proposta não recalcula nada.</p>
      </header>

      {analysis.executiveSummary && (
        <div className="border-b border-slate-100 px-5 py-5">
          <p className="max-w-4xl text-sm leading-6 text-slate-600">{analysis.executiveSummary}</p>
        </div>
      )}

      <div className="grid gap-4 p-5 lg:grid-cols-3">
        {analysis.dimensions.map((dimension) => (
          <article className="rounded-xl border border-slate-200 bg-white p-5" key={dimension.id}>
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-700">
              <GsIcon className="h-4 w-4" name={perspectiveIcon[dimension.perspective]} />
            </span>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{perspectiveLabels[dimension.perspective]}</p>
            <h3 className="mt-1 font-black text-slate-900">{humanize(dimension.code)}</h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">{dimension.summary}</p>
            {dimension.risks.length > 0 && (
              <div className="mt-3 rounded-lg bg-amber-50 p-3">
                <p className="text-[10px] font-black uppercase text-amber-800">Pontos de atenção</p>
                <ul className="mt-1 space-y-1 text-xs leading-5 text-amber-900">
                  {dimension.risks.map((risk) => <li key={risk}>• {risk}</li>)}
                </ul>
              </div>
            )}
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] font-semibold text-slate-500">
              <span>{dimension.evidenceCount} evidência(s)</span>
              <span>{dimension.pendingCount} pendência(s)</span>
            </div>
          </article>
        ))}
        {analysis.dimensions.length === 0 && (
          <p className="col-span-full rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-500">Nenhuma dimensão calculada ainda.</p>
        )}
      </div>
    </section>
  );
}
