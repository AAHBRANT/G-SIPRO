"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type FilterGroup = Readonly<{
  key: string;
  label: string;
  options: ReadonlyArray<{ value: string; label: string; count: number }>;
}>;

const chevron = <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>;
const check = <svg aria-hidden="true" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="3.4" viewBox="0 0 24 24"><path d="m5 13 4 4L19 7"/></svg>;
const cross = <svg aria-hidden="true" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.8" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>;

/**
 * Filtros da fila de triagem. O estado vive na barra de endereço para que a
 * seleção sobreviva a recarregar a página e possa ser compartilhada por link.
 */
export function ScoutedFilters({ groups, sortOptions }: { groups: ReadonlyArray<FilterGroup>; sortOptions: ReadonlyArray<{ value: string; label: string }> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState<string>();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function outside(event: MouseEvent) {
      if (open && box.current && !box.current.contains(event.target as Node)) setOpen(undefined);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(undefined);
    }
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  function apply(next: URLSearchParams) {
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function selected(key: string): string[] {
    return params.getAll(key);
  }

  function toggle(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    const current = next.getAll(key);
    next.delete(key);
    const after = current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
    for (const entry of after) next.append(key, entry);
    apply(next);
  }

  function clearGroup(key: string) {
    const next = new URLSearchParams(params.toString());
    next.delete(key);
    apply(next);
  }

  function setSingle(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    apply(next);
  }

  const activeCount = groups.reduce((total, group) => total + selected(group.key).length, 0) + (params.get("q") ? 1 : 0);

  return <div className="border-b border-slate-100" ref={box}>
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
      <form className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-brand focus-within:ring-4 focus-within:ring-red-50" onSubmit={(event) => { event.preventDefault(); setSingle("q", query.trim()); }}>
        <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.1" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4.3-4.3"/></svg>
        <input aria-label="Buscar" className="min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none placeholder:text-slate-400" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por objeto, órgão ou cidade e pressionar Enter…" value={query}/>
      </form>
      <label className="flex items-center gap-2 text-xs text-slate-500">Ordenar por
        <select className="h-9 rounded-lg border border-slate-200 px-2.5 text-[13px] text-slate-800" defaultValue={params.get("sort") ?? sortOptions[0]?.value} onChange={(event) => setSingle("sort", event.target.value)}>
          {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    </div>

    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
      {groups.map((group) => {
        const marked = selected(group.key);
        const isOpen = open === group.key;
        return <div className="relative" key={group.key}>
          <button
            aria-expanded={isOpen}
            className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold transition ${
              isOpen ? "border-brand text-slate-900 ring-4 ring-red-50"
              : marked.length ? "border-red-200 bg-red-50 text-[color:var(--brand-strong)]"
              : "border-slate-200 text-slate-700 hover:border-slate-300"}`}
            onClick={() => setOpen(isOpen ? undefined : group.key)}
            type="button"
          >
            {group.label}
            {marked.length > 0 && <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1.5 text-[10px] font-black text-white">{marked.length}</span>}
            <span className={`text-slate-400 transition ${isOpen ? "rotate-180" : ""}`}>{chevron}</span>
          </button>

          {isOpen && <div className="absolute left-0 top-[calc(100%+6px)] z-30 min-w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_32px_-10px_rgba(15,23,42,.28)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-2 pb-1.5 pt-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{group.label}</span>
              {marked.length > 0 && <button className="text-[11px] font-semibold text-brand hover:underline" onClick={() => clearGroup(group.key)} type="button">limpar</button>}
            </div>
            {group.options.map((option) => {
              const on = marked.includes(option.value);
              return <button
                aria-pressed={on}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
                disabled={option.count === 0 && !on}
                key={option.value}
                onClick={() => toggle(group.key, option.value)}
                type="button"
              >
                <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border-[1.6px] ${on ? "border-brand bg-brand text-white" : "border-slate-300 text-transparent"}`}>{check}</span>
                <span className="flex-1 truncate">{option.label}</span>
                <span className="text-[11px] tabular-nums text-slate-400">{option.count}</span>
              </button>;
            })}
          </div>}
        </div>;
      })}

      {activeCount > 0 && <div className="ml-auto flex flex-wrap items-center gap-2">
        {params.get("q") && <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 py-1 pl-3 pr-1 text-xs font-semibold text-[color:var(--brand-strong)]">
          “{params.get("q")}”
          <button aria-label="Remover busca" className="grid h-4 w-4 place-items-center rounded-full text-brand hover:bg-red-100" onClick={() => { setQuery(""); setSingle("q", ""); }} type="button">{cross}</button>
        </span>}
        {groups.flatMap((group) => selected(group.key).map((value) => {
          const label = group.options.find((option) => option.value === value)?.label ?? value;
          return <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 py-1 pl-3 pr-1 text-xs font-semibold text-[color:var(--brand-strong)]" key={`${group.key}-${value}`}>
            {label}
            <button aria-label={`Remover ${label}`} className="grid h-4 w-4 place-items-center rounded-full text-brand hover:bg-red-100" onClick={() => toggle(group.key, value)} type="button">{cross}</button>
          </span>;
        }))}
        <button className="text-xs font-semibold text-slate-500 hover:text-slate-900" onClick={() => { setQuery(""); router.push(pathname, { scroll: false }); }} type="button">Limpar tudo</button>
      </div>}
    </div>
  </div>;
}
