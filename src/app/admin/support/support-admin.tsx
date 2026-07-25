"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportTicketView } from "@/app/support/support-center";
import { SupportChat } from "@/app/support/support-chat";
import { SupportProgressCard } from "@/app/support/support-progress-card";
import { SupportResolutionForecastCard } from "@/app/support/support-resolution-forecast-card";
import { GsIcon } from "@/components/ui/gs-icon";

const typeLabel: Record<string, string> = { BUG: "Correção de bug", QUESTION: "Dúvida", IMPROVEMENT: "Melhoria", NEW_FEATURE: "Nova ferramenta" };
const statusLabel: Record<string, string> = { OPEN: "Recebido", TRIAGED: "Na fila técnica", WAITING_APPROVAL: "Aguardando aprovação", APPROVED: "Autorizado", IN_PROGRESS: "Em execução", WAITING_USER_VALIDATION: "Validação do solicitante", OWNER_ACTION_REQUIRED: "Ação do proprietário", ESCALATED: "Escalado ao proprietário", RESOLVED: "Resolvido", REJECTED: "Rejeitado", CANCELLED: "Cancelado" };
const statusTone: Record<string, string> = { OPEN: "bg-slate-100 text-slate-700", TRIAGED: "bg-slate-100 text-slate-700", WAITING_APPROVAL: "bg-amber-50 text-amber-800", APPROVED: "bg-slate-100 text-slate-700", IN_PROGRESS: "bg-blue-50 text-blue-800", WAITING_USER_VALIDATION: "bg-amber-50 text-amber-800", OWNER_ACTION_REQUIRED: "bg-amber-100 text-amber-900", ESCALATED: "bg-rose-50 text-rose-800", RESOLVED: "bg-emerald-50 text-emerald-800", REJECTED: "bg-slate-100 text-slate-600", CANCELLED: "bg-slate-100 text-slate-600" };
const concludedStatuses = new Set(["RESOLVED", "REJECTED", "CANCELLED"]);

export function SupportAdmin({ tickets, canApprove, currentActorId }: { tickets: Array<SupportTicketView & { reporter: string; reporterEmail: string }>; canApprove: boolean; currentActorId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [classFilter, setClassFilter] = useState<"" | "CORRECTION" | "CHANGE">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  async function send(ticketId: string, endpoint: string, payload: unknown) {
    setBusy(ticketId);
    setMessage("");
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined;
      if (!response.ok) throw new Error(result?.error?.message ?? "Não foi possível atualizar o chamado.");
      setMessage("Chamado atualizado e registrado no histórico.");
      setNotes((current) => ({ ...current, [ticketId]: "" }));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar o chamado.");
    } finally {
      setBusy(null);
    }
  }

  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId) ?? null;
  const diagnosis = selectedTicket?.aiDiagnosis;
  const externalBlocker = selectedTicket?.externalBlocker;
  const note = selectedTicket ? notes[selectedTicket.id] ?? "" : "";
  const executionAuthorized = selectedTicket ? (selectedTicket.status === "TRIAGED" && !selectedTicket.approvalRequired) || ["APPROVED", "IN_PROGRESS", "WAITING_USER_VALIDATION", "OWNER_ACTION_REQUIRED", "ESCALATED", "RESOLVED"].includes(selectedTicket.status) : false;
  const filteredTickets = useMemo(() => tickets.filter((ticket) => {
    const haystack = `SUP-${String(ticket.number).padStart(5, "0")} ${ticket.title} ${ticket.description} ${ticket.reporter} ${typeLabel[ticket.type] ?? ticket.type} ${statusLabel[ticket.status] ?? ticket.status}`.toLocaleLowerCase("pt-BR");
    const matchesClass = !classFilter
      || (classFilter === "CORRECTION" && ["BUG", "QUESTION"].includes(ticket.type))
      || (classFilter === "CHANGE" && ["IMPROVEMENT", "NEW_FEATURE"].includes(ticket.type));
    return (!query || haystack.includes(query.toLocaleLowerCase("pt-BR"))) && (!statusFilter || ticket.status === statusFilter) && (!typeFilter || ticket.type === typeFilter) && matchesClass;
  }), [tickets, query, statusFilter, typeFilter, classFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleTickets = filteredTickets.slice((safePage - 1) * pageSize, safePage * pageSize);
  const firstRecord = filteredTickets.length ? (safePage - 1) * pageSize + 1 : 0;
  const lastRecord = Math.min(safePage * pageSize, filteredTickets.length);
  const controlClass = "h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50";

  return <div className="mt-6">
    {message && <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">{message}</p>}
    <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_3px_12px_rgba(15,23,42,0.05)]" aria-label="Relação de chamados">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center"><h2 className="mr-auto flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-800"><GsIcon className="h-4 w-4 text-brand" name="table"/> Chamados registrados</h2><div className="flex flex-wrap gap-2"><label className="relative"><GsIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" name="search"/><input aria-label="Buscar chamado" className="h-9 w-60 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Buscar chamado..." value={query}/></label><button className={`${controlClass} inline-flex items-center gap-2`} onClick={() => setShowFilters((value) => !value)} type="button"><GsIcon className="h-4 w-4" name="filter"/> Filtros</button></div></div>
      <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50/60 px-4 py-2.5" aria-label="Separação por natureza do chamado">
        {[
          { value: "" as const, label: "Todos", count: tickets.length },
          { value: "CORRECTION" as const, label: "Correções e dúvidas", count: tickets.filter(ticket => ["BUG", "QUESTION"].includes(ticket.type)).length },
          { value: "CHANGE" as const, label: "Melhorias e novas ferramentas", count: tickets.filter(ticket => ["IMPROVEMENT", "NEW_FEATURE"].includes(ticket.type)).length },
        ].map(option => <button className={`rounded-full px-3 py-1.5 text-[10px] font-bold transition ${classFilter === option.value ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`} key={option.value || "ALL"} onClick={() => { setClassFilter(option.value); setPage(1); }} type="button">{option.label} · {option.count}</button>)}
      </div>
      {showFilters && <div className="grid gap-3 border-b border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-2 lg:grid-cols-4"><select aria-label="Filtrar por status" className={controlClass} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} value={statusFilter}><option value="">Todos os status</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label="Filtrar por tipo" className={controlClass} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }} value={typeFilter}><option value="">Todos os tipos</option>{Object.entries(typeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className={controlClass} onClick={() => { setStatusFilter(""); setTypeFilter(""); setClassFilter(""); setPage(1); }} type="button">Limpar filtros</button></div>}
      <div className="overflow-x-auto"><table className="w-full min-w-[1180px] table-fixed text-left text-xs"><colgroup><col className="w-[12%]"/><col className="w-[15%]"/><col className="w-[24%]"/><col className="w-[16%]"/><col className="w-[14%]"/><col className="w-[12%]"/><col className="w-[7%]"/></colgroup><thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Nº do chamado</th><th className="px-4 py-3">Solicitante</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Abertura / conclusão</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Previsão</th><th className="px-3 py-3 text-center">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">
        {visibleTickets.map((ticket) => <tr className="h-14 transition hover:bg-blue-50/30" key={ticket.id}>
          <td className="whitespace-nowrap px-4 py-3"><button className="font-bold text-brand hover:underline" onClick={() => setSelectedTicketId(ticket.id)} type="button">SUP-{String(ticket.number).padStart(5, "0")}</button><p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">{typeLabel[ticket.type]}</p></td>
          <td className="px-4 py-3"><p className="truncate font-semibold text-slate-700" title={ticket.reporter}>{ticket.reporter}</p><p className="mt-1 truncate text-[10px] text-slate-500" title={ticket.reporterEmail}>{ticket.reporterEmail}</p></td>
          <td className="px-4 py-3"><p className="truncate font-semibold text-slate-700" title={ticket.title}>{ticket.title}</p><p className="mt-1 truncate text-[10px] text-slate-500" title={ticket.description}>{ticket.description}</p></td>
          <td className="whitespace-nowrap px-4 py-3 text-[10px] text-slate-600"><p><b>Abertura:</b> {new Date(ticket.createdAt).toLocaleDateString("pt-BR")}</p><p className="mt-1"><b>Conclusão:</b> {concludedStatuses.has(ticket.status) ? new Date(ticket.updatedAt).toLocaleDateString("pt-BR") : "Em aberto"}</p></td>
          <td className="px-4 py-3"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone[ticket.status] ?? statusTone.OPEN}`}>{statusLabel[ticket.status] ?? ticket.status}</span></td>
          <td className="px-4 py-3"><SupportResolutionForecastCard compact ticket={ticket}/></td>
          <td className="px-3 py-3 text-center"><button aria-label={`Visualizar SUP-${String(ticket.number).padStart(5, "0")}`} className="inline-grid rounded-md p-1.5 text-blue-700 transition hover:bg-blue-100" onClick={() => setSelectedTicketId(ticket.id)} title="Visualizar" type="button"><GsIcon className="h-4 w-4" name="eye"/></button></td>
        </tr>)}
        {visibleTickets.length === 0 && <tr><td className="px-5 py-12 text-center text-sm text-slate-500" colSpan={7}>Nenhum chamado registrado.</td></tr>}
      </tbody></table></div>
      <footer className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-[10px] text-slate-500 sm:flex-row sm:items-center"><span>Mostrando {firstRecord} a {lastRecord} de {filteredTickets.length} chamados</span><div className="ml-auto flex items-center gap-1.5"><select aria-label="Quantidade de linhas" className="h-8 rounded-lg border border-slate-200 bg-white px-2 font-semibold" onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} value={pageSize}>{[10, 25, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}</select><button className="h-8 rounded-lg border border-slate-200 px-3 font-semibold disabled:opacity-40" disabled={safePage <= 1} onClick={() => setPage((value) => value - 1)} type="button">Anterior</button><span className="grid h-8 min-w-8 place-items-center rounded-lg border border-brand font-bold text-brand">{safePage}</span><span className="px-1">de {totalPages}</span><button className="h-8 rounded-lg border border-slate-200 px-3 font-semibold disabled:opacity-40" disabled={safePage >= totalPages} onClick={() => setPage((value) => value + 1)} type="button">Próximo</button></div></footer>
    </section>

    {selectedTicket && <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="support-ticket-title">
      <button aria-label="Fechar detalhes do chamado" className="absolute inset-0 bg-slate-950/45" onClick={() => setSelectedTicketId(null)} type="button"/>
      <aside className="relative h-full w-full max-w-3xl overflow-y-auto bg-[#f6f6f4] shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div><p className="text-xs font-black uppercase tracking-wider text-brand">SUP-{String(selectedTicket.number).padStart(5, "0")} · {typeLabel[selectedTicket.type]}</p><h2 className="mt-1 text-xl font-black text-slate-950" id="support-ticket-title">{selectedTicket.title}</h2><p className="mt-1 text-xs text-slate-500">{selectedTicket.reporter} · {new Date(selectedTicket.createdAt).toLocaleString("pt-BR")}</p></div>
          <button aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-xl text-slate-500 hover:bg-slate-50" onClick={() => setSelectedTicketId(null)} type="button">×</button>
        </header>
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">Prioridade {selectedTicket.priority}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone[selectedTicket.status] ?? statusTone.OPEN}`}>{statusLabel[selectedTicket.status]}</span></div>
          <div className="mt-4"><SupportProgressCard executionAttempts={selectedTicket.executionAttempts ?? 0} resolutionAttempts={selectedTicket.resolutionAttempts ?? 0} status={selectedTicket.status} updatedAt={selectedTicket.updatedAt}/></div>
          <div className="mt-4"><SupportResolutionForecastCard ticket={selectedTicket}/></div>
          <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4"><h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Descrição do chamado</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedTicket.description}</p></section>
        {selectedTicket.errorMessage && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-800"><b>Erro:</b> {selectedTicket.errorMessage}</p>}
        {diagnosis && <div className="mt-4 grid gap-3 rounded-xl border border-violet-200 bg-violet-50/40 p-4 md:grid-cols-2">
          <div><p className="text-xs font-black uppercase text-violet-700">Diagnóstico</p><p className="mt-2 text-sm font-bold">{diagnosis.summary}</p><p className="mt-2 text-xs leading-5 text-slate-600"><b>Causa provável:</b> {diagnosis.probableCause}</p></div>
          <div><p className="text-xs font-black uppercase text-violet-700">Plano recomendado</p><p className="mt-2 text-sm text-slate-700">{diagnosis.recommendedAction}</p><p className="mt-2 text-xs font-bold text-slate-500">{diagnosis.changeClass} · risco {diagnosis.severity} · confiança {Math.round((diagnosis.confidence ?? 0) * 100)}%</p></div>
        </div>}
        {selectedTicket.attachments.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{selectedTicket.attachments.map((file) => <a className="rounded-lg border px-3 py-2 text-xs font-bold text-brand" href={`/api/support/attachments/${file.id}/content`} key={file.id} target="_blank" rel="noreferrer">{file.fileName}</a>)}</div>}
        {selectedTicket.status === "WAITING_APPROVAL" && <section className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <p className="text-xs font-black uppercase tracking-wider text-amber-900">Decisão do proprietário</p>
          <p className="mt-2 text-sm font-bold text-amber-950">{selectedTicket.approvalReason ?? "Esta solicitação altera uma função do sistema e precisa de aprovação antes da execução."}</p>
          <p className="mt-2 text-xs leading-5 text-amber-900">Registre uma justificativa abaixo. Ao aprovar, o chamado entra automaticamente na fila da IA; ao rejeitar, ele é encerrado sem alteração no software.</p>
        </section>}
        {executionAuthorized && <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50/50 p-4">
          <p className="text-xs font-black uppercase tracking-wider text-cyan-800">Ponte de execução</p>
          <p className="mt-1 text-xs text-cyan-900">Diagnóstico, evidências e testes estão reunidos em um pacote técnico rastreável. Erros seguem automaticamente; mudanças funcionais seguem após a aprovação registrada.</p>
          {selectedTicket.executorId && <p className="mt-2 text-xs font-semibold text-cyan-950">Executor: {selectedTicket.executorId} · execução técnica nº {selectedTicket.executionAttempts ?? 1}{selectedTicket.executionHeartbeatAt ? ` · último sinal ${new Date(selectedTicket.executionHeartbeatAt).toLocaleString("pt-BR")}` : ""}</p>}
          <a className="mt-3 inline-flex rounded-lg border border-cyan-300 bg-white px-3 py-2 text-xs font-bold text-cyan-800" href={`/api/support/tickets/${selectedTicket.id}/execution`} target="_blank" rel="noreferrer">Abrir pacote técnico</a>
        </div>}
        {selectedTicket.status === "WAITING_USER_VALIDATION" && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">Solução entregue. Aguardando o solicitante responder “Posso encerrar este chamado?” — tentativa {selectedTicket.resolutionAttempts ?? 1} de 3.</p>}
        {selectedTicket.status === "OWNER_ACTION_REQUIRED" && externalBlocker && <section className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="text-xs font-black uppercase tracking-wider">Pendência protegida · {externalBlocker.category}</p>
          <p className="mt-2 font-bold">{externalBlocker.summary}</p>
          <p className="mt-3 whitespace-pre-wrap"><b>Como resolver:</b><br/>{externalBlocker.ownerAction}</p>
          <p className="mt-3 rounded-lg bg-white/80 p-3 text-xs"><b>Segurança:</b> {externalBlocker.securityGuidance}</p>
          <p className="mt-3 text-xs font-semibold">Execute somente a ação indicada, descreva abaixo o que foi feito e confirme. A IA retomará o chamado automaticamente.</p>
        </section>}
        {selectedTicket.status === "ESCALATED" && <p className="mt-4 rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-900">Três tentativas automáticas não produziram uma solução validável. Este chamado requer atuação direta do proprietário.</p>}
        {["WAITING_APPROVAL", "OWNER_ACTION_REQUIRED", "RESOLVED"].includes(selectedTicket.status) && <textarea className="mt-4 min-h-20 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm" onChange={(event) => setNotes((current) => ({ ...current, [selectedTicket.id]: event.target.value }))} placeholder="Registre a decisão ou ação realizada" value={note}/>}
        <div className="mt-3 flex flex-wrap gap-2">
          {["TRIAGED", "APPROVED"].includes(selectedTicket.status) && <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-800">Execução automática liberada. Nenhum início manual é necessário.</p>}
          {selectedTicket.status === "WAITING_APPROVAL" && canApprove && <><button className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={busy === selectedTicket.id || note.trim().length < 3} onClick={() => send(selectedTicket.id, "decision", { decision: "APPROVED", note })}>Aprovar e liberar IA</button><button className="rounded-lg border border-rose-300 bg-white px-4 py-2 text-xs font-bold text-rose-700 disabled:opacity-50" disabled={busy === selectedTicket.id || note.trim().length < 3} onClick={() => send(selectedTicket.id, "decision", { decision: "REJECTED", note })}>Rejeitar solicitação</button></>}
          {selectedTicket.status === "ESCALATED" && canApprove && <button className="rounded-lg bg-rose-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={busy === selectedTicket.id} onClick={() => send(selectedTicket.id, "escalation", {})}>Assumir chamado escalado</button>}
          {selectedTicket.status === "OWNER_ACTION_REQUIRED" && canApprove && <button className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={busy === selectedTicket.id || note.trim().length < 3} onClick={() => send(selectedTicket.id, "escalation", { note })}>Confirmar ação e devolver à IA</button>}
          {selectedTicket.status === "RESOLVED" && canApprove && <button className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900 disabled:opacity-50" disabled={busy === selectedTicket.id || note.trim().length < 3} onClick={() => send(selectedTicket.id, "reopen", { note })}>Reabrir chamado</button>}
        </div>
        <SupportChat currentActorId={currentActorId} messages={selectedTicket.updates} ticketId={selectedTicket.id}/>
        </div>
      </aside>
    </div>}
  </div>;
}
