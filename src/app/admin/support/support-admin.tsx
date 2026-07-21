"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportTicketView } from "@/app/support/support-center";
import { SupportChat } from "@/app/support/support-chat";
import { SupportProgressCard } from "@/app/support/support-progress-card";

const typeLabel: Record<string, string> = { BUG: "Erro", QUESTION: "Dúvida", IMPROVEMENT: "Melhoria", NEW_FEATURE: "Nova ferramenta" };
const statusLabel: Record<string, string> = { OPEN: "Recebido", TRIAGED: "Na fila técnica", WAITING_APPROVAL: "Aguardando aprovação", APPROVED: "Autorizado", IN_PROGRESS: "Em execução", WAITING_USER_VALIDATION: "Validação do solicitante", ESCALATED: "Escalado ao proprietário", RESOLVED: "Resolvido", REJECTED: "Rejeitado", CANCELLED: "Cancelado" };
const statusTone: Record<string, string> = { OPEN: "bg-slate-100 text-slate-700", TRIAGED: "bg-slate-100 text-slate-700", WAITING_APPROVAL: "bg-amber-50 text-amber-800", APPROVED: "bg-slate-100 text-slate-700", IN_PROGRESS: "bg-blue-50 text-blue-800", WAITING_USER_VALIDATION: "bg-amber-50 text-amber-800", ESCALATED: "bg-rose-50 text-rose-800", RESOLVED: "bg-emerald-50 text-emerald-800", REJECTED: "bg-slate-100 text-slate-600", CANCELLED: "bg-slate-100 text-slate-600" };
const concludedStatuses = new Set(["RESOLVED", "REJECTED", "CANCELLED"]);

export function SupportAdmin({ tickets, canApprove, currentActorId }: { tickets: Array<SupportTicketView & { reporter: string; reporterEmail: string }>; canApprove: boolean; currentActorId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [revisions, setRevisions] = useState<Record<string, string>>({});
  const [deploymentUrls, setDeploymentUrls] = useState<Record<string, string>>({});
  const [executedTests, setExecutedTests] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

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
  const note = selectedTicket ? notes[selectedTicket.id] ?? "" : "";
  const revision = selectedTicket ? revisions[selectedTicket.id] ?? "" : "";
  const deploymentUrl = selectedTicket ? deploymentUrls[selectedTicket.id] ?? "" : "";
  const testLines = selectedTicket ? (executedTests[selectedTicket.id] ?? "").split("\n").map((item) => item.trim()).filter(Boolean) : [];
  const executionAuthorized = selectedTicket ? (selectedTicket.status === "TRIAGED" && !selectedTicket.approvalRequired) || ["APPROVED", "IN_PROGRESS", "WAITING_USER_VALIDATION", "ESCALATED", "RESOLVED"].includes(selectedTicket.status) : false;

  return <div className="mt-6">
    {message && <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">{message}</p>}
    <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]" aria-label="Relação de chamados">
      <header className="flex flex-col justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center"><div><h2 className="font-black text-slate-950">Chamados registrados</h2><p className="mt-1 text-xs text-slate-500">Selecione um chamado para visualizar informações, histórico e ações.</p></div><span className="text-xs font-bold text-slate-500">{tickets.length} registro(s)</span></header>
      <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Nº do chamado</th><th className="px-5 py-3">Descrição</th><th className="px-5 py-3">Abertura / conclusão</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">
        {tickets.map((ticket) => <tr className="transition hover:bg-slate-50/80" key={ticket.id}>
          <td className="whitespace-nowrap px-5 py-4 align-top"><button className="font-black text-brand hover:underline" onClick={() => setSelectedTicketId(ticket.id)} type="button">SUP-{String(ticket.number).padStart(5, "0")}</button><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{typeLabel[ticket.type]}</p></td>
          <td className="max-w-md px-5 py-4 align-top"><p className="font-bold text-slate-900">{ticket.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{ticket.description}</p></td>
          <td className="whitespace-nowrap px-5 py-4 align-top text-xs text-slate-600"><p><b>Abertura:</b> {new Date(ticket.createdAt).toLocaleDateString("pt-BR")}</p><p className="mt-1"><b>Conclusão:</b> {concludedStatuses.has(ticket.status) ? new Date(ticket.updatedAt).toLocaleDateString("pt-BR") : "Em aberto"}</p></td>
          <td className="px-5 py-4 align-top"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusTone[ticket.status] ?? statusTone.OPEN}`}>{statusLabel[ticket.status] ?? ticket.status}</span></td>
          <td className="px-5 py-4 text-right align-top"><button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50" onClick={() => setSelectedTicketId(ticket.id)} type="button">Visualizar</button></td>
        </tr>)}
        {tickets.length === 0 && <tr><td className="px-5 py-12 text-center text-sm text-slate-500" colSpan={5}>Nenhum chamado registrado.</td></tr>}
      </tbody></table></div>
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
          <div className="mt-4"><SupportProgressCard resolutionAttempts={selectedTicket.resolutionAttempts ?? 0} status={selectedTicket.status} updatedAt={selectedTicket.updatedAt}/></div>
          <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4"><h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Descrição do chamado</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedTicket.description}</p></section>
        {selectedTicket.errorMessage && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-800"><b>Erro:</b> {selectedTicket.errorMessage}</p>}
        {diagnosis && <div className="mt-4 grid gap-3 rounded-xl border border-violet-200 bg-violet-50/40 p-4 md:grid-cols-2">
          <div><p className="text-xs font-black uppercase text-violet-700">Diagnóstico</p><p className="mt-2 text-sm font-bold">{diagnosis.summary}</p><p className="mt-2 text-xs leading-5 text-slate-600"><b>Causa provável:</b> {diagnosis.probableCause}</p></div>
          <div><p className="text-xs font-black uppercase text-violet-700">Plano recomendado</p><p className="mt-2 text-sm text-slate-700">{diagnosis.recommendedAction}</p><p className="mt-2 text-xs font-bold text-slate-500">{diagnosis.changeClass} · risco {diagnosis.severity} · confiança {Math.round((diagnosis.confidence ?? 0) * 100)}%</p></div>
        </div>}
        {selectedTicket.attachments.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{selectedTicket.attachments.map((file) => <a className="rounded-lg border px-3 py-2 text-xs font-bold text-brand" href={`/api/support/attachments/${file.id}/content`} key={file.id} target="_blank" rel="noreferrer">{file.fileName}</a>)}</div>}
        {executionAuthorized && <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50/50 p-4">
          <p className="text-xs font-black uppercase tracking-wider text-cyan-800">Ponte de execução</p>
          <p className="mt-1 text-xs text-cyan-900">Diagnóstico, evidências e testes estão reunidos em um pacote técnico rastreável. As três tentativas seguem sem aprovação manual.</p>
          {selectedTicket.executorId && <p className="mt-2 text-xs font-semibold text-cyan-950">Executor: {selectedTicket.executorId} · execução técnica nº {selectedTicket.executionAttempts ?? 1}{selectedTicket.executionHeartbeatAt ? ` · último sinal ${new Date(selectedTicket.executionHeartbeatAt).toLocaleString("pt-BR")}` : ""}</p>}
          <a className="mt-3 inline-flex rounded-lg border border-cyan-300 bg-white px-3 py-2 text-xs font-bold text-cyan-800" href={`/api/support/tickets/${selectedTicket.id}/execution`} target="_blank" rel="noreferrer">Abrir pacote técnico</a>
        </div>}
        {selectedTicket.status === "WAITING_USER_VALIDATION" && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">Solução entregue. Aguardando o solicitante responder “Posso encerrar este chamado?” — tentativa {selectedTicket.resolutionAttempts ?? 1} de 3.</p>}
        {selectedTicket.status === "ESCALATED" && <p className="mt-4 rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-900">Três tentativas completas não solucionaram o problema. Este chamado requer atuação direta do proprietário.</p>}
        <textarea className="mt-4 min-h-20 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm" onChange={(event) => setNotes((current) => ({ ...current, [selectedTicket.id]: event.target.value }))} placeholder={selectedTicket.status === "IN_PROGRESS" ? "Descreva a solução realmente implantada" : "Registre a decisão ou orientação"} value={note}/>
        {selectedTicket.status === "IN_PROGRESS" && <div className="mt-3 grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 md:grid-cols-2"><label className="grid gap-1 text-xs font-bold text-emerald-950">Revisão ou commit implantado<input className="rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-xs font-normal" minLength={7} onChange={(event) => setRevisions((current) => ({ ...current, [selectedTicket.id]: event.target.value }))} placeholder="Ex.: 65508f5" value={revision}/></label><label className="grid gap-1 text-xs font-bold text-emerald-950">URL do ambiente publicado<input className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-normal" onChange={(event) => setDeploymentUrls((current) => ({ ...current, [selectedTicket.id]: event.target.value }))} placeholder="https://..." type="url" value={deploymentUrl}/></label><label className="grid gap-1 text-xs font-bold text-emerald-950 md:col-span-2">Testes realmente executados — um por linha<textarea className="min-h-20 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-normal" onChange={(event) => setExecutedTests((current) => ({ ...current, [selectedTicket.id]: event.target.value }))} placeholder="Teste realizado e resultado observado" value={executedTests[selectedTicket.id] ?? ""}/></label></div>}
        <div className="mt-3 flex flex-wrap gap-2">
          {["TRIAGED", "APPROVED", "WAITING_APPROVAL"].includes(selectedTicket.status) && <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-800">Execução automática ativa. Nenhuma aprovação ou início manual é necessário.</p>}
          {selectedTicket.status === "IN_PROGRESS" && <button className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={busy === selectedTicket.id || note.trim().length < 3 || revision.trim().length < 7 || !deploymentUrl.startsWith("https://") || testLines.length === 0} onClick={() => send(selectedTicket.id, "execution", { action: "COMPLETE", summary: note, tests: testLines, revision, deploymentUrl })}>Concluir após implantação</button>}
          {selectedTicket.status === "ESCALATED" && canApprove && <button className="rounded-lg bg-rose-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={busy === selectedTicket.id} onClick={() => send(selectedTicket.id, "escalation", {})}>Assumir chamado escalado</button>}
          {selectedTicket.status === "RESOLVED" && canApprove && <button className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900 disabled:opacity-50" disabled={busy === selectedTicket.id || note.trim().length < 3} onClick={() => send(selectedTicket.id, "reopen", { note })}>Reabrir chamado</button>}
        </div>
        <SupportChat currentActorId={currentActorId} messages={selectedTicket.updates} ticketId={selectedTicket.id}/>
        </div>
      </aside>
    </div>}
  </div>;
}
