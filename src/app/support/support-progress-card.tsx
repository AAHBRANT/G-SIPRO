import { supportProgress } from "@/modules/support/domain/support-progress";

const tones = {
  blue: "border-blue-200 bg-blue-50 text-blue-950",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-950",
  amber: "border-amber-300 bg-amber-50 text-amber-950",
  green: "border-emerald-200 bg-emerald-50 text-emerald-950",
  rose: "border-rose-300 bg-rose-50 text-rose-950",
  slate: "border-slate-200 bg-slate-50 text-slate-800",
};

const stages = ["Recebido", "Analisado", "Execução da IA", "Validação"];

export function SupportProgressCard({ status, executionAttempts, resolutionAttempts, updatedAt }: { status: string; executionAttempts: number; resolutionAttempts: number; updatedAt: string }) {
  const progress = supportProgress({ status, executionAttempts, resolutionAttempts, updatedAt });
  return <section className={`rounded-xl border-2 p-5 ${tones[progress.tone]}`} aria-label="Andamento do chamado">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-black uppercase tracking-wider opacity-70">Andamento do chamado</p><h4 className="mt-1 text-lg font-black">{progress.headline}</h4></div>
      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black">Tentativa {progress.attempt} de 3</span>
    </div>
    <p className="mt-3 text-sm font-semibold leading-6">{progress.description}</p>
    <p className="mt-2 text-sm leading-6">{progress.nextStep}</p>
    <ol className="mt-5 grid gap-2 sm:grid-cols-4" aria-label="Etapas do atendimento">{stages.map((label, index) => {
      const number = index + 1;
      const complete = number < progress.stage || status === "RESOLVED";
      const current = number === progress.stage && status !== "RESOLVED";
      return <li className={`rounded-lg border px-3 py-2 text-xs font-bold ${complete ? "border-emerald-200 bg-emerald-100 text-emerald-800" : current ? "border-current bg-white/80" : "border-white/70 bg-white/40 opacity-60"}`} key={label}>
        <span className="mr-1">{complete ? "✓" : number}.</span> {label}
      </li>;
    })}</ol>
    <p className="mt-3 text-[11px] font-semibold opacity-65">Última atualização: {new Date(updatedAt).toLocaleString("pt-BR")}</p>
  </section>;
}
