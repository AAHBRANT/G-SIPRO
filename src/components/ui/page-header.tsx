import type { ReactNode } from "react";
import { GsIcon, type GsIconName } from "./gs-icon";

export function PageHeader({ icon, title, subtitle, action, eyebrow }: { icon: GsIconName; title: string; subtitle: string; action?: ReactNode; eyebrow?: string }) {
  return <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center"><div className="flex min-w-0 items-center gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-blue-100 bg-blue-50 text-brand"><GsIcon className="h-6 w-6" name={icon}/></span><div className="min-w-0">{eyebrow && <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>}<h1 className="text-[28px] font-black leading-tight tracking-[-0.025em] text-slate-950 sm:text-[32px]">{title}</h1><p className="mt-1 text-sm text-slate-500 sm:text-base">{subtitle}</p></div></div>{action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}</header>;
}
