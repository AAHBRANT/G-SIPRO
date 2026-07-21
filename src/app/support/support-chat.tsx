"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export type SupportChatMessage = {
  id: string;
  note: string;
  createdAt: string;
  createdBy: string;
  createdById?: string | null;
};

export function SupportChat({ ticketId, messages, currentActorId }: { ticketId: string; messages: SupportChatMessage[]; currentActorId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const ordered = useMemo(() => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()), [messages]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = message.trim();
    if (!content) return;
    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: content }) });
      const payload = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined;
      if (!response.ok) throw new Error(payload?.error?.message ?? "Não foi possível enviar a mensagem.");
      setMessage("");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível enviar a mensagem.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
    <header className="border-b border-slate-200 bg-white px-4 py-3"><p className="text-xs font-black uppercase tracking-wider text-slate-700">Conversa do chamado</p><p className="mt-1 text-xs text-slate-500">Solicitante, suporte e proprietário conversam no mesmo histórico.</p></header>
    <div className="max-h-80 space-y-3 overflow-y-auto p-4">
      {ordered.map((item) => { const mine = item.createdById === currentActorId; return <div className={`flex ${mine ? "justify-end" : "justify-start"}`} key={item.id}><div className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm ${mine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-700"}`}><p className={`text-[10px] font-black uppercase tracking-wide ${mine ? "text-blue-100" : "text-slate-400"}`}>{mine ? "Você" : item.createdBy}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-5">{item.note}</p><p className={`mt-2 text-[10px] ${mine ? "text-blue-100" : "text-slate-400"}`}>{new Date(item.createdAt).toLocaleString("pt-BR")}</p></div></div>; })}
      {ordered.length === 0 && <p className="py-6 text-center text-xs text-slate-500">Nenhuma mensagem ainda.</p>}
    </div>
    <form className="flex gap-2 border-t border-slate-200 bg-white p-3" onSubmit={send}><label className="sr-only" htmlFor={`support-message-${ticketId}`}>Mensagem</label><textarea className="min-h-11 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand" id={`support-message-${ticketId}`} maxLength={2000} onChange={(event) => setMessage(event.target.value)} placeholder="Digite uma mensagem para o chamado…" value={message}/><button className="self-end rounded-xl bg-brand px-4 py-3 text-xs font-bold text-white disabled:opacity-50" disabled={busy || !message.trim()}>{busy ? "Enviando…" : "Enviar"}</button></form>
    {feedback && <p className="border-t border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">{feedback}</p>}
  </section>;
}
