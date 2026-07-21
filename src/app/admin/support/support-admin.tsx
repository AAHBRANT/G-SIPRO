"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportTicketView } from "@/app/support/support-center";
import { SupportChat } from "@/app/support/support-chat";

const typeLabel: Record<string, string> = { BUG: "Erro", QUESTION: "Dúvida", IMPROVEMENT: "Melhoria", NEW_FEATURE: "Nova ferramenta" };
const statusLabel: Record<string, string> = { OPEN: "Recebido", TRIAGED: "Na fila técnica", WAITING_APPROVAL: "Aguardando aprovação", APPROVED: "Autorizado", IN_PROGRESS: "Em execução", RESOLVED: "Resolvido", REJECTED: "Rejeitado", CANCELLED: "Cancelado" };

export function SupportAdmin({ tickets, canApprove, currentActorId }: { tickets: Array<SupportTicketView & { reporter: string; reporterEmail: string }>; canApprove: boolean; currentActorId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [revisions, setRevisions] = useState<Record<string, string>>({});
  const [deploymentUrls, setDeploymentUrls] = useState<Record<string, string>>({});
  const [executedTests, setExecutedTests] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

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

  return <div className="mt-6 grid gap-4">
    {message && <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">{message}</p>}
    {tickets.map((ticket) => {
      const diagnosis = ticket.aiDiagnosis;
      const note = notes[ticket.id] ?? "";
      const revision = revisions[ticket.id] ?? "";
      const deploymentUrl = deploymentUrls[ticket.id] ?? "";
      const testLines = (executedTests[ticket.id] ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
      const executionAuthorized = (ticket.status === "TRIAGED" && !ticket.approvalRequired) || ["APPROVED", "IN_PROGRESS", "RESOLVED"].includes(ticket.status);
      return <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" key={ticket.id}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-brand">SUP-{String(ticket.number).padStart(5, "0")} · {typeLabel[ticket.type]}</p>
            <h2 className="mt-1 text-lg font-black text-slate-950">{ticket.title}</h2>
            <p className="mt-1 text-xs text-slate-500">{ticket.reporter} · {ticket.reporterEmail} · {new Date(ticket.createdAt).toLocaleString("pt-BR")}</p>
          </div>
          <div className="flex gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{ticket.priority}</span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{statusLabel[ticket.status]}</span>
          </div>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{ticket.description}</p>
        {ticket.errorMessage && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-800"><b>Erro:</b> {ticket.errorMessage}</p>}
        {diagnosis && <div className="mt-4 grid gap-3 rounded-xl border border-violet-200 bg-violet-50/40 p-4 md:grid-cols-2">
          <div><p className="text-xs font-black uppercase text-violet-700">Diagnóstico</p><p className="mt-2 text-sm font-bold">{diagnosis.summary}</p><p className="mt-2 text-xs leading-5 text-slate-600"><b>Causa provável:</b> {diagnosis.probableCause}</p></div>
          <div><p className="text-xs font-black uppercase text-violet-700">Plano recomendado</p><p className="mt-2 text-sm text-slate-700">{diagnosis.recommendedAction}</p><p className="mt-2 text-xs font-bold text-slate-500">{diagnosis.changeClass} · risco {diagnosis.severity} · confiança {Math.round((diagnosis.confidence ?? 0) * 100)}%</p></div>
        </div>}
        {ticket.attachments.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{ticket.attachments.map((file) => <a className="rounded-lg border px-3 py-2 text-xs font-bold text-brand" href={`/api/support/attachments/${file.id}/content`} key={file.id} target="_blank" rel="noreferrer">{file.fileName}</a>)}</div>}
        {executionAuthorized && <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50/50 p-4">
          <p className="text-xs font-black uppercase tracking-wider text-cyan-800">Ponte de execução</p>
          <p className="mt-1 text-xs text-cyan-900">Diagnóstico, autorização, evidências e testes estão reunidos em um pacote técnico rastreável.</p>
          {ticket.executorId && <p className="mt-2 text-xs font-semibold text-cyan-950">Executor: {ticket.executorId} · tentativa {ticket.executionAttempts ?? 1}{ticket.executionHeartbeatAt ? ` · último sinal ${new Date(ticket.executionHeartbeatAt).toLocaleString("pt-BR")}` : ""}</p>}
          <a className="mt-3 inline-flex rounded-lg border border-cyan-300 bg-white px-3 py-2 text-xs font-bold text-cyan-800" href={`/api/support/tickets/${ticket.id}/execution`} target="_blank" rel="noreferrer">Abrir pacote técnico</a>
        </div>}
        <textarea className="mt-4 min-h-20 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" onChange={(event) => setNotes((current) => ({ ...current, [ticket.id]: event.target.value }))} placeholder={ticket.status === "IN_PROGRESS" ? "Descreva a solução realmente implantada" : "Registre a decisão ou orientação"} value={note}/>
        {ticket.status === "IN_PROGRESS" && <div className="mt-3 grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 md:grid-cols-2"><label className="grid gap-1 text-xs font-bold text-emerald-950">Revisão ou commit implantado<input className="rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-xs font-normal" minLength={7} onChange={(event) => setRevisions((current) => ({ ...current, [ticket.id]: event.target.value }))} placeholder="Ex.: 65508f5" value={revision}/></label><label className="grid gap-1 text-xs font-bold text-emerald-950">URL do ambiente publicado<input className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-normal" onChange={(event) => setDeploymentUrls((current) => ({ ...current, [ticket.id]: event.target.value }))} placeholder="https://..." type="url" value={deploymentUrl}/></label><label className="grid gap-1 text-xs font-bold text-emerald-950 md:col-span-2">Testes realmente executados — um por linha<textarea className="min-h-20 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-normal" onChange={(event) => setExecutedTests((current) => ({ ...current, [ticket.id]: event.target.value }))} placeholder="Teste realizado e resultado observado" value={executedTests[ticket.id] ?? ""}/></label></div>}
        <div className="mt-3 flex flex-wrap gap-2">
          {ticket.status === "WAITING_APPROVAL" && canApprove && <>
            <button className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={busy === ticket.id || note.trim().length < 3} onClick={() => send(ticket.id, "decision", { decision: "APPROVED", note })}>Aprovar execução</button>
            <button className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={busy === ticket.id || note.trim().length < 3} onClick={() => send(ticket.id, "decision", { decision: "REJECTED", note })}>Rejeitar</button>
          </>}
          {ticket.status === "WAITING_APPROVAL" && !canApprove && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800">Aguardando decisão de um proprietário.</p>}
          {((ticket.status === "TRIAGED" && !ticket.approvalRequired) || ticket.status === "APPROVED") && <button className="rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={busy === ticket.id} onClick={() => send(ticket.id, "execution", { action: "CLAIM" })}>Iniciar execução técnica</button>}
          {ticket.status === "IN_PROGRESS" && <button className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={busy === ticket.id || note.trim().length < 3 || revision.trim().length < 7 || !deploymentUrl.startsWith("https://") || testLines.length === 0} onClick={() => send(ticket.id, "execution", { action: "COMPLETE", summary: note, tests: testLines, revision, deploymentUrl })}>Concluir após implantação</button>}
          {ticket.status === "RESOLVED" && canApprove && <button className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900 disabled:opacity-50" disabled={busy === ticket.id || note.trim().length < 3} onClick={() => send(ticket.id, "reopen", { note })}>Reabrir chamado</button>}
        </div>
        <SupportChat currentActorId={currentActorId} messages={ticket.updates} ticketId={ticket.id}/>
      </article>;
    })}
    {tickets.length === 0 && <p className="rounded-xl border border-dashed p-10 text-center text-sm text-slate-500">Nenhum chamado registrado.</p>}
  </div>;
}
