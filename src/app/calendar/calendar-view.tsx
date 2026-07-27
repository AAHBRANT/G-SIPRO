"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { GsIcon } from "@/components/ui/gs-icon";
import { MetricCard } from "@/components/ui/metric-card";

type EntryType = "DEADLINE" | "DELIVERY" | "MEETING";
type EventCategory = "MEETING" | "TRAVEL" | "INTERNAL_DEADLINE" | "PERSONAL" | "OTHER";
type Entry = {
  id: string;
  type: EntryType;
  title: string;
  description?: string;
  startAt: string;
  endAt?: string;
  responsibleId?: string;
  responsibleName?: string;
  participantNames?: string[];
  category?: EventCategory;
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

const typeDot: Record<EntryType, string> = {
  DEADLINE: "bg-amber-500",
  DELIVERY: "bg-blue-500",
  MEETING: "bg-violet-500",
};

// Compromissos de equipe (MEETING) ganham cor por assunto, em vez do violeta único —
// prazos de edital e entregas de proposta continuam com a cor fixa por tipo acima.
const categoryLabels: Record<EventCategory, string> = {
  MEETING: "Reunião",
  TRAVEL: "Viagem / visita técnica",
  INTERNAL_DEADLINE: "Prazo interno",
  PERSONAL: "Compromisso pessoal",
  OTHER: "Outro",
};

const categoryTone: Record<EventCategory, string> = {
  MEETING: "bg-violet-50 text-violet-700",
  TRAVEL: "bg-cyan-50 text-cyan-700",
  INTERNAL_DEADLINE: "bg-rose-50 text-rose-700",
  PERSONAL: "bg-slate-100 text-slate-700",
  OTHER: "bg-fuchsia-50 text-fuchsia-700",
};

const categoryDot: Record<EventCategory, string> = {
  MEETING: "bg-violet-500",
  TRAVEL: "bg-cyan-500",
  INTERNAL_DEADLINE: "bg-rose-500",
  PERSONAL: "bg-slate-500",
  OTHER: "bg-fuchsia-500",
};

function entryTone(entry: Entry): string {
  return entry.type === "MEETING" ? categoryTone[entry.category ?? "MEETING"] : typeTone[entry.type];
}

function entryDot(entry: Entry): string {
  return entry.type === "MEETING" ? categoryDot[entry.category ?? "MEETING"] : typeDot[entry.type];
}

function initials(name?: string): string {
  if (!name) return "?";
  // Ignora anotações entre parênteses (ex.: "(fictício)") para não virar iniciais erradas.
  const parts = name.trim().split(/\s+/).filter((part) => /^\p{L}/u.test(part));
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const weekdayLabels = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const monthLabels = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const controlClass = "h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50";
const fieldClass = "rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal text-slate-800";

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fullDateTimeLabel(value: string) {
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function isSameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function toDateTimeLocalValue(day: Date, hour = 9) {
  const value = new Date(day);
  value.setHours(hour, 0, 0, 0);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function buildMonthGrid(monthAnchor: Date) {
  const firstOfMonth = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

function buildWeekGrid(anchor: Date) {
  const weekStart = new Date(anchor);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    return day;
  });
}

function weekRangeLabel(anchor: Date) {
  const week = buildWeekGrid(anchor);
  const [start, end] = [week[0], week[6]];
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = sameMonth ? `${start.getDate()}` : `${start.getDate()} de ${monthLabels[start.getMonth()].toLowerCase()}`;
  return `${startLabel} – ${end.getDate()} de ${monthLabels[end.getMonth()].toLowerCase()} de ${end.getFullYear()}`;
}

export function CalendarView({ users, canManage, currentUserId }: { users: readonly { id: string; name: string }[]; canManage: boolean; currentUserId: string }) {
  const [entries, setEntries] = useState<readonly Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<EntryType | "">("");
  const [category, setCategory] = useState<EventCategory | "">("");
  const [responsible, setResponsible] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaultStart, setCreateDefaultStart] = useState("");
  const [viewingEntry, setViewingEntry] = useState<Entry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const today = useMemo(() => new Date(), []);
  const [viewMode, setViewMode] = useState<"month" | "week" | "year">("month");
  const [anchorDate, setAnchorDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/calendar", { cache: "no-store" });
      const payload = (await response.json()) as { data?: Entry[]; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Não foi possível consultar o calendário.");
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
          (!category || entry.category === category) &&
          (!responsible || entry.responsibleId === responsible) &&
          (!onlyMine || entry.responsibleId === currentUserId)
        );
      }),
    [entries, query, type, category, responsible, onlyMine, currentUserId],
  );

  const entriesByDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const entry of filtered) {
      const key = dateKey(new Date(entry.startAt));
      const bucket = map.get(key) ?? [];
      bucket.push(entry);
      map.set(key, bucket);
    }
    for (const bucket of map.values()) bucket.sort((left, right) => left.startAt.localeCompare(right.startAt));
    return map;
  }, [filtered]);

  const counts = {
    DEADLINE: entries.filter((entry) => entry.type === "DEADLINE").length,
    DELIVERY: entries.filter((entry) => entry.type === "DELIVERY").length,
    MEETING: entries.filter((entry) => entry.type === "MEETING").length,
  };

  const monthGrid = useMemo(() => buildMonthGrid(anchorDate), [anchorDate]);
  const weekGrid = useMemo(() => buildWeekGrid(anchorDate), [anchorDate]);
  const yearMonths = useMemo(
    () => Array.from({ length: 12 }, (_, month) => ({ month, days: buildMonthGrid(new Date(anchorDate.getFullYear(), month, 1)) })),
    [anchorDate],
  );
  const selectedDayEntries = selectedDate ? entriesByDay.get(dateKey(selectedDate)) ?? [] : [];

  function goToToday() {
    const now = new Date();
    setAnchorDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    setSelectedDate(now);
  }

  function shiftPeriod(offset: number) {
    setAnchorDate((current) => {
      if (viewMode === "week") {
        const next = new Date(current);
        next.setDate(next.getDate() + offset * 7);
        return next;
      }
      if (viewMode === "year") return new Date(current.getFullYear() + offset, current.getMonth(), 1);
      return new Date(current.getFullYear(), current.getMonth() + offset, 1);
    });
  }

  function goToMonth(month: number) {
    setAnchorDate(new Date(anchorDate.getFullYear(), month, 1));
    setViewMode("month");
  }

  function openCreateForDay(day: Date) {
    setCreateDefaultStart(toDateTimeLocalValue(day));
    setCreateOpen(true);
  }

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
      participantIds: form.getAll("participantIds"),
      category: form.get("category"),
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
      setCreateDefaultStart("");
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

  function renderDayCell(day: Date, options: { inMonth: boolean; maxVisible: number; minHeightClass: string }) {
    const isToday = isSameDay(day, today);
    const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
    const dayEntries = entriesByDay.get(dateKey(day)) ?? [];
    const visible = dayEntries.slice(0, options.maxVisible);
    const overflow = dayEntries.length - visible.length;
    return (
      <div
        className={`group relative ${options.minHeightClass} cursor-pointer border-b border-r border-slate-100 p-2 text-left align-top transition hover:bg-blue-50/40 ${options.inMonth ? "bg-white" : "bg-slate-50/60"} ${isSelected ? "ring-2 ring-inset ring-brand" : ""}`}
        key={day.toISOString()}
        onClick={() => setSelectedDate(day)}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedDate(day); } }}
        role="button"
        tabIndex={0}
      >
        <div className="flex items-center justify-between">
          <span className={`inline-grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${isToday ? "bg-brand text-white" : options.inMonth ? "text-slate-700" : "text-slate-400"}`}>{day.getDate()}</span>
          {canManage && (
            <button
              aria-label={`Novo compromisso em ${day.getDate()}/${day.getMonth() + 1}`}
              className="grid h-5 w-5 place-items-center rounded text-slate-400 opacity-0 transition hover:bg-brand hover:text-white group-hover:opacity-100"
              onClick={(event) => { event.stopPropagation(); openCreateForDay(day); }}
              title="Novo compromisso neste dia"
              type="button"
            >
              +
            </button>
          )}
        </div>
        <div className="mt-1 space-y-1">
          {visible.map((entry) => (
            <button
              className={`flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[10px] font-semibold transition hover:brightness-95 ${entryTone(entry)}`}
              key={`${entry.type}-${entry.id}`}
              onClick={(clickEvent) => { clickEvent.stopPropagation(); setViewingEntry(entry); }}
              title={`${entry.title} · ${entry.responsibleName ?? "Não atribuído"}`}
              type="button"
            >
              <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-white/70 text-[8px] font-black">{initials(entry.responsibleName)}</span>
              <span className="truncate">{timeLabel(entry.startAt)} {entry.title}</span>
            </button>
          ))}
          {overflow > 0 && <span className="block px-1.5 text-[10px] font-bold text-slate-500">+{overflow} mais</span>}
        </div>
      </div>
    );
  }

  return (
    <>
      <section aria-label="Indicadores do calendário" className="mt-6 grid gap-3 sm:grid-cols-3">
        <MetricCard description="Vencimentos de editais em acompanhamento" icon="clock" title="Prazos de editais" tone="amber" value={counts.DEADLINE} variant="executive" />
        <MetricCard description="Datas-limite de propostas em aberto" icon="send" title="Entregas de proposta" tone="blue" value={counts.DELIVERY} variant="executive" />
        <MetricCard description="Reuniões e compromissos cadastrados pela equipe" icon="calendar" title="Compromissos de equipe" tone="violet" value={counts.MEETING} variant="executive" />
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_3px_12px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center">
          <div className="mr-auto flex flex-wrap items-center gap-3">
            <button className={controlClass} onClick={goToToday} type="button">Hoje</button>
            <div className="flex items-center gap-1">
              <button aria-label="Período anterior" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50" onClick={() => shiftPeriod(-1)} type="button">
                <GsIcon className="h-4 w-4 rotate-180" name="arrow" />
              </button>
              <button aria-label="Próximo período" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50" onClick={() => shiftPeriod(1)} type="button">
                <GsIcon className="h-4 w-4" name="arrow" />
              </button>
            </div>
            <h2 className="text-lg font-black text-slate-900">
              {viewMode === "month" && `${monthLabels[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`}
              {viewMode === "week" && weekRangeLabel(anchorDate)}
              {viewMode === "year" && anchorDate.getFullYear()}
            </h2>
            <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {([["month", "Mês"], ["week", "Semana"], ["year", "Ano"]] as const).map(([mode, label]) => (
                <button
                  aria-pressed={viewMode === mode}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${viewMode === mode ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <GsIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" name="search" />
              <input aria-label="Buscar compromisso" className="h-9 w-60 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título ou responsável..." value={query} />
            </div>
            <button className={`${controlClass} inline-flex items-center gap-2`} onClick={() => setShowFilters((value) => !value)} type="button">
              <GsIcon className="h-4 w-4" name="filter" /> Filtros
            </button>
            <button
              aria-pressed={onlyMine}
              className={`${controlClass} inline-flex items-center gap-2 ${onlyMine ? "border-brand bg-blue-50 text-brand" : ""}`}
              onClick={() => setOnlyMine((value) => !value)}
              type="button"
            >
              Meus compromissos
            </button>
            {canManage && (
              <button
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--brand-strong)]"
                onClick={() => { setCreateDefaultStart(""); setCreateOpen(true); }}
                type="button"
              >
                <span className="text-base font-normal">＋</span> Novo
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="grid gap-3 border-b border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-4">
            <label className="grid gap-1 text-[10px] font-bold uppercase text-slate-500">
              Tipo
              <select className={controlClass} onChange={(event) => setType(event.target.value as EntryType | "")} value={type}>
                <option value="">Todos os tipos</option>
                {(Object.keys(typeLabels) as EntryType[]).map((value) => <option key={value} value={value}>{typeLabels[value]}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[10px] font-bold uppercase text-slate-500">
              Assunto
              <select className={controlClass} onChange={(event) => setCategory(event.target.value as EventCategory | "")} value={category}>
                <option value="">Todos os assuntos</option>
                {(Object.keys(categoryLabels) as EventCategory[]).map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[10px] font-bold uppercase text-slate-500">
              Responsável
              <select className={controlClass} onChange={(event) => setResponsible(event.target.value)} value={responsible}>
                <option value="">Todos os responsáveis</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </label>
            <button className={`${controlClass} self-end`} onClick={() => { setType(""); setCategory(""); setResponsible(""); setQuery(""); setOnlyMine(false); }} type="button">Limpar filtros</button>
          </div>
        )}

        {message && <p className="border-b border-slate-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-900" role="status">{message}</p>}
        {loading && <p className="border-b border-slate-200 px-4 py-3 text-center text-xs text-slate-500">Consultando calendário…</p>}

        {(viewMode === "month" || viewMode === "week") && (
          <div className="overflow-x-auto">
            <div className="grid min-w-[900px] grid-cols-7 border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
              {weekdayLabels.map((label) => <div className="px-3 py-2 text-center" key={label}>{label.slice(0, 3)}</div>)}
            </div>
            <div className="grid min-w-[900px] grid-cols-7">
              {viewMode === "month"
                ? monthGrid.map((day) => renderDayCell(day, { inMonth: day.getMonth() === anchorDate.getMonth(), maxVisible: 3, minHeightClass: "min-h-28" }))
                : weekGrid.map((day) => renderDayCell(day, { inMonth: true, maxVisible: 8, minHeightClass: "min-h-64" }))}
            </div>
          </div>
        )}

        {viewMode === "year" && (
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {yearMonths.map(({ month, days }) => (
              <div className="rounded-lg border border-slate-200 p-2" key={month}>
                <button className="mb-1 w-full rounded px-1 py-0.5 text-center text-xs font-black text-slate-800 transition hover:bg-blue-50 hover:text-brand" onClick={() => goToMonth(month)} type="button">
                  {monthLabels[month]}
                </button>
                <div className="grid grid-cols-7 gap-y-0.5 text-center text-[9px] text-slate-400">
                  {weekdayLabels.map((label) => <span key={label}>{label.slice(0, 1)}</span>)}
                  {days.map((day) => {
                    const inMonth = day.getMonth() === month;
                    const hasEntries = (entriesByDay.get(dateKey(day)) ?? []).length > 0;
                    const isToday = isSameDay(day, today);
                    return (
                      <button
                        className={`relative grid h-5 w-5 place-items-center justify-self-center rounded-full text-[9px] font-bold transition hover:bg-blue-50 ${isToday ? "bg-brand text-white" : inMonth ? "text-slate-600" : "text-slate-300"}`}
                        key={day.toISOString()}
                        onClick={() => { setAnchorDate(new Date(day.getFullYear(), day.getMonth(), 1)); setSelectedDate(day); setViewMode("month"); }}
                        type="button"
                      >
                        {day.getDate()}
                        {hasEntries && <span className="absolute bottom-0 h-1 w-1 rounded-full bg-brand" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedDate && (
        <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_3px_12px_rgba(15,23,42,0.05)]">
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-black text-slate-900">
              {weekdayLabels[selectedDate.getDay()]}, {selectedDate.getDate()} de {monthLabels[selectedDate.getMonth()].toLowerCase()}
            </h3>
            <button aria-label="Fechar detalhes do dia" className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-50" onClick={() => setSelectedDate(null)} type="button">×</button>
          </header>
          <div className="divide-y divide-slate-100">
            {selectedDayEntries.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-500">Nenhum item neste dia.</p>}
            {selectedDayEntries.map((entry) => (
              <div className="flex flex-wrap items-center gap-3 px-4 py-3" key={`${entry.type}-${entry.id}`}>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${entryDot(entry)}`} />
                <span className="w-16 shrink-0 text-xs font-bold text-slate-600">{timeLabel(entry.startAt)}</span>
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-black text-slate-700" title={entry.responsibleName ?? "Não atribuído"}>{initials(entry.responsibleName)}</span>
                <div className="min-w-0 flex-1">
                  {entry.href ? <Link className="block truncate font-bold text-brand hover:underline" href={entry.href}>{entry.title}</Link> : <span className="block truncate font-semibold text-slate-800">{entry.title}</span>}
                  <span className="text-xs text-slate-500">{entry.type === "MEETING" ? categoryLabels[entry.category ?? "MEETING"] : typeLabels[entry.type]} · {entry.responsibleName ?? "Não atribuído"}</span>
                </div>
                {entry.editable && canManage && (
                  <button className="rounded-md p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50" disabled={cancellingId === entry.id} onClick={() => cancelEntry(entry.id)} title="Cancelar compromisso" type="button">
                    <GsIcon className="h-4 w-4" name="ban" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

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
                <label className="grid gap-1 text-sm font-semibold">Início<input className={fieldClass} defaultValue={createDefaultStart} name="startAt" required type="datetime-local" /></label>
                <label className="grid gap-1 text-sm font-semibold">Término<input className={fieldClass} name="endAt" type="datetime-local" /></label>
              </div>
              <label className="grid gap-1 text-sm font-semibold">
                Assunto
                <select className={fieldClass} defaultValue="MEETING" name="category">
                  {(Object.keys(categoryLabels) as EventCategory[]).map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                Responsável
                <select className={fieldClass} defaultValue={currentUserId} name="responsibleId" required>
                  <option value="">Selecione o responsável</option>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.id === currentUserId ? `${user.name} (eu)` : user.name}</option>)}
                </select>
                <span className="text-xs font-normal text-slate-500">Deixe seu nome selecionado para criar na sua própria agenda, ou escolha outra pessoa para delegar o compromisso.</span>
              </label>
              <div className="grid gap-1 text-sm font-semibold">
                Participantes
                <div className="grid max-h-40 gap-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                  {users.map((user) => (
                    <label className="flex items-center gap-2 rounded px-1.5 py-1 text-sm font-normal text-slate-700 hover:bg-slate-50" key={user.id}>
                      <input name="participantIds" type="checkbox" value={user.id} />
                      {user.id === currentUserId ? `${user.name} (eu)` : user.name}
                    </label>
                  ))}
                </div>
                <span className="text-xs font-normal text-slate-500">Opcional. Cada participante selecionado recebe o compromisso no próprio Outlook/Teams.</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button className="rounded-lg bg-brand px-5 py-2.5 font-bold text-white disabled:opacity-60" disabled={submitting}>{submitting ? "Salvando…" : "Salvar compromisso"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingEntry && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Detalhes do compromisso">
          <div className="mx-auto my-8 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${entryDot(viewingEntry)}`} />
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
                  {viewingEntry.type === "MEETING" ? categoryLabels[viewingEntry.category ?? "MEETING"] : typeLabels[viewingEntry.type]}
                </p>
              </div>
              <button aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-xl text-slate-500 hover:bg-slate-50" onClick={() => setViewingEntry(null)} type="button">×</button>
            </div>
            <h2 className="text-xl font-black text-slate-950">{viewingEntry.title}</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-slate-500">Início</dt>
                <dd className="text-right font-semibold text-slate-800">{fullDateTimeLabel(viewingEntry.startAt)}</dd>
              </div>
              {viewingEntry.endAt && (
                <div className="flex items-start justify-between gap-4">
                  <dt className="font-semibold text-slate-500">Término</dt>
                  <dd className="text-right font-semibold text-slate-800">{fullDateTimeLabel(viewingEntry.endAt)}</dd>
                </div>
              )}
              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-slate-500">Responsável</dt>
                <dd className="flex items-center gap-2 text-right font-semibold text-slate-800">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-100 text-[9px] font-black text-slate-700">{initials(viewingEntry.responsibleName)}</span>
                  {viewingEntry.responsibleName ?? "Não atribuído"}
                </dd>
              </div>
              {viewingEntry.participantNames && viewingEntry.participantNames.length > 0 && (
                <div className="flex items-start justify-between gap-4">
                  <dt className="font-semibold text-slate-500">Participantes</dt>
                  <dd className="text-right font-semibold text-slate-800">{viewingEntry.participantNames.join(", ")}</dd>
                </div>
              )}
              {viewingEntry.description && (
                <div>
                  <dt className="font-semibold text-slate-500">Descrição</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-slate-800">{viewingEntry.description}</dd>
                </div>
              )}
            </dl>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              {viewingEntry.href ? <Link className="font-bold text-brand hover:underline" href={viewingEntry.href}>Abrir registro vinculado</Link> : <span />}
              {viewingEntry.editable && canManage && (
                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                  disabled={cancellingId === viewingEntry.id}
                  onClick={async () => { await cancelEntry(viewingEntry.id); setViewingEntry(null); }}
                  type="button"
                >
                  <GsIcon className="h-4 w-4" name="ban" /> Cancelar compromisso
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
