"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type FilterGroup = Readonly<{
  key: string;
  label: string;
  options: ReadonlyArray<{ value: string; label: string; count: number }>;
}>;

const chevron = <svg aria-hidden="true" className="seta h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>;
const check = <svg aria-hidden="true" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="3.4" viewBox="0 0 24 24"><path d="m5 13 4 4L19 7"/></svg>;
const cross = <svg aria-hidden="true" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.8" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>;
const lupa = <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.1" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4.3-4.3"/></svg>;

/**
 * Barra de filtros da fila de triagem, em uma única faixa: busca, ordenação,
 * grupos e corte de aderência. O estado vive na barra de endereço para que a
 * seleção sobreviva a recarregar a página e possa ser passada por link.
 */
export function ScoutedFilters({ groups, sortOptions }: { groups: ReadonlyArray<FilterGroup>; sortOptions: ReadonlyArray<{ value: string; label: string }> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState<string>();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const box = useRef<HTMLDivElement>(null);

  const adherenceParam = Number(params.get("ader") ?? 0);
  const adherenceFloor = Number.isFinite(adherenceParam) ? Math.max(0, Math.min(100, adherenceParam)) : 0;
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
    const search = next.toString();
    router.push(search ? `${pathname}?${search}` : pathname, { scroll: false });
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

  const activeCount = groups.reduce((total, group) => total + selected(group.key).length, 0)
    + (params.get("q") ? 1 : 0)
    + (adherenceFloor > 0 ? 1 : 0);

  return <div ref={box}>
    <div className="bx-barra">
      <form className="bx-busca" onSubmit={(event) => { event.preventDefault(); setSingle("q", query.trim()); }}>
        {lupa}
        <input aria-label="Buscar" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por objeto, órgão ou cidade e pressionar Enter…" value={query}/>
      </form>

      {groups.map((group) => {
        const marked = selected(group.key);
        const isOpen = open === group.key;
        return <div className="relative" key={group.key}>
          <button aria-expanded={isOpen} className="bx-chip" data-ativo={marked.length ? "sim" : "nao"} onClick={() => setOpen(isOpen ? undefined : group.key)} type="button">
            {group.label}
            {marked.length > 0 && <span className="qtd">{marked.length}</span>}
            {chevron}
          </button>

          {isOpen && <div className="bx-menu">
            <div className="bx-menu-cab">
              <span>{group.label}</span>
              {marked.length > 0 && <button onClick={() => clearGroup(group.key)} type="button">limpar</button>}
            </div>
            {group.options.map((option) => {
              const on = marked.includes(option.value);
              return <button
                aria-pressed={on}
                className="bx-op"
                disabled={option.count === 0 && !on}
                key={option.value}
                onClick={() => toggle(group.key, option.value)}
                type="button"
              >
                <span className="cx">{check}</span>
                <span className="flex-1 truncate">{option.label}</span>
                <span className="n">{option.count}</span>
              </button>;
            })}
          </div>}
        </div>;
      })}

      <AdherenceRange floor={adherenceFloor} key={adherenceFloor} onCommit={(value) => setSingle("ader", value > 0 ? String(value) : "")}/>

      <label className="bx-chip" style={{ cursor: "default" }}>
        <span className="text-[var(--texto-3)]">Ordenar</span>
        <select
          className="border-0 bg-transparent font-bold outline-none"
          onChange={(event) => setSingle("sort", event.target.value)}
          style={{ color: "inherit", fontFamily: "inherit", fontSize: "12.5px" }}
          value={params.get("sort") ?? sortOptions[0]?.value}
        >
          {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    </div>

    {activeCount > 0 && <div className="bx-barra" style={{ paddingTop: 8, paddingBottom: 8 }}>
      {params.get("q") && <span className="bx-selo">
        “{params.get("q")}”
        <button aria-label="Remover busca" onClick={() => { setQuery(""); setSingle("q", ""); }} type="button">{cross}</button>
      </span>}
      {adherenceFloor > 0 && <span className="bx-selo">
        aderência ≥ {adherenceFloor}%
        <button aria-label="Remover corte de aderência" onClick={() => setSingle("ader", "")} type="button">{cross}</button>
      </span>}
      {groups.flatMap((group) => selected(group.key).map((value) => {
        const label = group.options.find((option) => option.value === value)?.label ?? value;
        return <span className="bx-selo" key={`${group.key}-${value}`}>
          {label}
          <button aria-label={`Remover ${label}`} onClick={() => toggle(group.key, value)} type="button">{cross}</button>
        </span>;
      }))}
      <button className="bx-limpar ml-auto" onClick={() => { setQuery(""); router.push(pathname, { scroll: false }); }} type="button">Limpar tudo</button>
    </div>}
  </div>;
}

/**
 * Barra de aderência mínima. O valor local existe só para o número acompanhar o
 * arrasto; a consulta sai quando a mão para, senão a fila recarregaria dezenas
 * de vezes num gesto só.
 *
 * Quem monta passa `key={floor}`: quando a barra de endereço muda — voltar,
 * avançar, limpar tudo — o componente é remontado e nasce já com o valor certo,
 * sem sincronizar estado dentro de efeito.
 */
function AdherenceRange({ floor, onCommit }: { floor: number; onCommit: (value: number) => void }) {
  const [value, setValue] = useState(floor);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function slide(next: number) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onCommit(next), 320);
  }

  return <div className="bx-ader" data-ativo={floor > 0 ? "sim" : "nao"}>
    <label htmlFor="ader">Aderência mín.</label>
    <input id="ader" max={100} min={0} onChange={(event) => slide(Number(event.target.value))} step={5} type="range" value={value}/>
    <span className="pc">{value}%</span>
  </div>;
}
