import { GsIcon, type GsIconName } from "./gs-icon";

type Tone = "blue" | "green" | "amber" | "red" | "slate" | "violet";
const tones: Record<Tone, { icon: string; value: string }> = {
  blue: { icon: "bg-blue-600", value: "text-blue-700" }, green: { icon: "bg-emerald-500", value: "text-emerald-600" }, amber: { icon: "bg-amber-500", value: "text-amber-600" }, red: { icon: "bg-red-500", value: "text-red-600" }, slate: { icon: "bg-slate-600", value: "text-slate-700" }, violet: { icon: "bg-violet-500", value: "text-violet-700" },
};

export function MetricCard({ title, value, description, icon, tone = "blue" }: { title: string; value: string | number; description: string; icon: GsIconName; tone?: Tone }) {
  const style = tones[tone];
  return <article className="min-h-36 rounded-xl border border-slate-200 bg-white p-6 shadow-[0_2px_10px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]"><div className="flex items-start gap-4"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-white shadow-sm ${style.icon}`}><GsIcon name={icon}/></span><div className="min-w-0"><p className="min-h-9 text-xs font-extrabold uppercase leading-4 tracking-wide text-slate-600">{title}</p><p className={`mt-1 text-[36px] font-black leading-none tracking-[-0.035em] ${style.value}`}>{value}</p></div></div><p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">{description}</p></article>;
}
