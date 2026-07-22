"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { GsIcon } from "@/components/ui/gs-icon";

const controlClass = "h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50";
const statusOptions = [
  ["", "Todos os status"],
  ["DRAFT", "Rascunho"],
  ["QUALIFICATION", "Qualificação"],
  ["ACTIVE", "Ativa"],
  ["SUSPENDED", "Suspensa"],
  ["CLOSED", "Encerrada"],
] as const;

function opportunitiesHref(query: string, status: string, pageSize: number) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("query", query.trim());
  if (status) params.set("status", status);
  params.set("page", "1");
  params.set("pageSize", String(pageSize));
  return `/opportunities?${params.toString()}`;
}

export function OpportunityTableControls({ query, status, pageSize, action }: { query: string; status: string; pageSize: number; action?: ReactNode }) {
  const router = useRouter();
  const [search, setSearch] = useState(query);
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [showFilters, setShowFilters] = useState(Boolean(status));

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    router.push(opportunitiesHref(search, selectedStatus, pageSize));
  }

  return <>
    <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center">
      <h2 className="mr-auto flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-800"><GsIcon className="h-4 w-4 text-brand" name="table"/> Relação de oportunidades</h2>
      <div className="flex flex-wrap items-center gap-2">
        <form className="flex items-center gap-2" onSubmit={submitSearch}>
          <div className="relative"><button aria-label="Executar busca" className="absolute left-2 top-1.5 grid h-6 w-6 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-brand" title="Buscar" type="submit"><GsIcon className="h-4 w-4" name="search"/></button><input aria-label="Buscar oportunidade" className="h-9 w-60 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" onChange={event => setSearch(event.target.value)} placeholder="Buscar oportunidade..." value={search}/></div>
        </form>
        <button className={`${controlClass} inline-flex items-center gap-2`} onClick={() => setShowFilters(value => !value)} type="button"><GsIcon className="h-4 w-4" name="filter"/> Filtros</button>
        {action}
      </div>
    </div>
    {showFilters && <div className="grid gap-3 border-b border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-[minmax(220px,320px)_auto_auto] sm:items-end">
      <label className="grid gap-1 text-[10px] font-bold uppercase text-slate-500">Status<select className={controlClass} onChange={event => setSelectedStatus(event.target.value)} value={selectedStatus}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className={`${controlClass} border-brand text-brand`} onClick={() => router.push(opportunitiesHref(search, selectedStatus, pageSize))} type="button">Aplicar filtros</button>
      <button className={controlClass} onClick={() => { setSelectedStatus(""); router.push(opportunitiesHref(search, "", pageSize)); }} type="button">Limpar filtros</button>
    </div>}
  </>;
}

export function OpportunityPageSizeSelect({ query, status, pageSize }: { query: string; status: string; pageSize: number }) {
  const router = useRouter();
  return <select aria-label="Quantidade de linhas" className="h-8 rounded-lg border border-slate-200 bg-white px-2 font-semibold" onChange={event => router.push(opportunitiesHref(query, status, Number(event.target.value)))} value={pageSize}>{[10, 25, 50, 100].map(value => <option key={value} value={value}>{value}</option>)}</select>;
}
