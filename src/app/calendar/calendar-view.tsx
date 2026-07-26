"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { GsIcon } from "@/components/ui/gs-icon";
import { MetricCard } from "@/components/ui/metric-card";

type EntryType = "DEADLINE" | "DELIVERY" | "MEETING";
type Entry = {
  id: string;
  type: EntryType;
  title: string;
  startAt: string;
  endAt?: string;
  responsibleId?: string;
  responsibleName?: string;
  editable: boolean;
  href?: string;
};

const typeLabels: Record<EntryType, string> = {
  DEADLINE: "Prazo de edital",
  DELIVERY: "Entrega de proposta",
  MEETING: "Compromisso de equipe",
};

const typeTone: Record<EntryType, string> = {
  DEADLINE: "bg-amber-50 text-amber-700",
  DELIVERY: "bg-blue-50 text-blue-700",
  MEETING: "bg-violet-50 text-violet-700",
};

const controlClass = "h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50";
const fieldClass = "rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal text-slate-800";

function dateTimeLabel(value: string) {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function CalendarView({ users, canManage }: { users: readonly { id: string; name: string }[]; canManage: boolean }) {
  const [entries, setEntries] = useState<readonly Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<EntryType | "">("");
  const [responsible, setResponsible] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/calendar", { cache: "no-store" });
      const payload = (await response.json()) as { data?: Entry[]; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Não foi possível consultar a agenda.");
      setEntries(payload.data ?? []);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha de conexão. Verifique sua rede e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(
    () =>
      entries.filter((entry) => {
        const haystack = `${entry.title} ${entry.responsibleName ?? ""}`.toLocaleLowerCase("pt-BR");
        return (
          (!query || haystack.includes(query.toLocaleLowerCase("pt-BR"))) &&
          (!type || entry.type === type) &&
          (!responsible || entry.responsibleId === responsible)
        );
      }),
    [entries, query, type, responsible],
  );

  const counts = {
    DEADLINE: entries.filter((entry) => entry.type === "DEADLINE").length,
    DELIVERY: entries.filter((entry) => entry.type === "DELIVERY").length,
    MEETING: entries.filter((entry) => entry.type === "MEETING").length,
  };

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSubmitting(true);
    setMessage("");
    const payload = {
      title: form.get("title")?.toString().trim(),
      description: form.get("description")?.toString().trim() || undefined,
      startAt: form.get("startAt"),
      endAt: form.get("endAt") || undefined,
      responsibleId: form.get("responsibleId"),
    };
    try {
      const response = await fetch("/api/calendar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: { message?: string } };
      setSubmitting(false);
      if (!response.ok) {
        setMessage(result.error?.message ?? "Não foi possível registrar o compromisso.");
        return;
      }
      formElement.reset();
      setCreateOpen(false);
      await load();
    } catch {
      setSubmitting(false);
      setMessage("Falha de conexão. Verifique sua rede e tente novamente.");
    }
  }

  async function cancelEntry(id: string) {
    setCancellingId(id);
    try {
      const response = await fetch(`/api/calendar/${id}/cancel`, { method: "POST" });
      const result = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setMessage(result.error?.message ?? "Não foi possível cancelar o compromisso.");
        return;
      }
      await load();
    } catch {
      setMessage("Falha de conexão. Verifique sua rede e tente novamente.");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <>
      <section aria-label="Indicadores da agenda" className="mt-6 grid gap-3 sm:grid-cols-3">
        <MetricCard description="Vencimentos de editais em acompanhamento" icon="clock" title="Prazos de editais" tone="amber" value={counts.DEADLINE} variant="executive" />
        <MetricCard description="Datas-limite de propostas em aberto" icon="send" title="Entregas de proposta" tone="blue" value={counts.DELIVERY} variant="executive" />
        <MetricCard description="Reuniões e compromissos cadastrados pela equipe" icon="calendar" title="Compromissos de equipe" tone="violet" value={counts.MEETING} variant="executive" />
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_3px_12px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center">
          <h2 className="mr-auto flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-800">
            <GsIcon className="h-4 w-4 text-brand" name="table" /> Agenda consolidada
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <GsIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" name="search" />
              <input aria-label="Buscar compromisso" className="h-9 w-60 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título ou responsável..." value={query} />
            </div>
            <button className={`${controlClass} inline-flex items-center gap-2`} onClick={() => setShowFilters((value) => !value)} type="button">
              <GsIcon className="h-4 w-4" name="filter" /> Filtros
            </button>
            {canManage && (
              <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--brand-strong)]" onClick={() => setCreateOpen(true)} type="button">
                <span className="text-base font-normal">＋</span> Novo compromisso
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="grid gap-3 border-b border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-3">
            <label className="grid gap-1 text-[10px] font-bold uppercase text-slate-500">
              Tipo
              <select className={controlClass} onChange={(event) => setType(event.target.value as EntryType | "")} value={type}>
                <option value="">Todos os tipos</option>
                {(Object.keys(typeLabels) as EntryType[]).map((value) => <option key={value} value={value}>{typeLabels[value]}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[10px] font-bold uppercase text-slate-500">
              Responsável
              <select className={controlClass} onChange={(event) => setResponsible(event.target.value)} value={responsible}>
                <option value="">Todos os responsáveis</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </label>
            <button className={`${controlClass} self-end`} onClick={() => { setType(""); setResponsible(""); setQuery(""); }} type="button">Limpar filtros</button>
          </div>
        )}

        {message && <p className="border-b border-slate-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-900" role="status">{message}</p>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Responsável</th>
                <th className="px-3 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={5}>Consultando agenda…</td></tr>}
              {!loading && filtered.map((entry) => (
                <tr className="h-14 transition hover:bg-blue-50/30" key={`${entry.type}-${entry.id}`}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{dateTimeLabel(entry.startAt)}</td>
                  <td className="px-4 py-3">
                    {entry.href ? <Link className="block truncate font-bold text-brand hover:underline" href={entry.href}>{entry.title}</Link> : <span className="block truncate font-semibold text-slate-800">{entry.title}</span>}
                  </td>
                  <td className="px-4 py-3"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${typeTone[entry.type]}`}>{typeLabels[entry.type]}</span></td>
                  <td className="px-4 py-3"><span className="block truncate text-slate-600">{entry.responsibleName ?? "Não atribuído"}</span></td>
                  <td className="px-3 py-3 text-center">
                    {entry.editable && canManage && (
                      <button className="rounded-md p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50" disabled={cancellingId === entry.id} onClick={() => cancelEntry(entry.id)} title="Cancelar compromisso" type="button">
                        <GsIcon className="h-4 w-4" name="ban" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={5}>Nenhum item encontrado para os filtros aplicados.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {createOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Novo compromisso">
          <div className="mx-auto my-8 w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Novo registro</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Novo compromisso</h2>
                <p className="mt-1 text-sm text-slate-500">Reuniões, visitas e prazos internos que não têm outro controle no sistema.</p>
              </div>
              <button aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-xl text-slate-500 hover:bg-slate-50" onClick={() => setCreateOpen(false)} type="button">×</button>
            </div>
            <form className="grid gap-4" onSubmit={submitCreate}>
              <label className="grid gap-1 text-sm font-semibold">Título<input className={fieldClass} maxLength={200} name="title" required /></label>
              <label className="grid gap-1 text-sm font-semibold">Descrição<textarea className={`${fieldClass} min-h-20`} maxLength={2000} name="description" /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold">Início<input className={fieldClass} name="startAt" required type="datetime-local" /></label>
                <label className="grid gap-1 text-sm font-semibold">Término<input className={fieldClass} name="endAt" type="datetime-local" /></label>
              </div>
              <label className="grid gap-1 text-sm font-semibold">
                Responsável
                <select className={fieldClass} name="responsibleId" required>
                  <option value="">Selecione o responsável</option>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button className="rounded-lg bg-brand px-5 py-2.5 font-bold text-white disabled:opacity-60" disabled={submitting}>{submitting ? "Salvando…" : "Salvar compromisso"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
