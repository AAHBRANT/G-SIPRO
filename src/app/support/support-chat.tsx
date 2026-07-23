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

export function SupportChat({ messages, currentActorId, ticketId }: { ticketId: string; messages: SupportChatMessage[]; currentActorId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const ordered = useMemo(() => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()), [messages]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const instruction = message.trim();
    if (instruction.length < 3) return;
    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}/assistant`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: instruction }),
      });
      const result = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined;
      if (!response.ok) throw new Error(result?.error?.message ?? "Não foi possível enviar a solicitação à IA.");
      setMessage("");
      setFeedback("Solicitação recebida pela IA do G-SIPRO.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao enviar a solicitação.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
    <header className="border-b border-slate-200 bg-white px-4 py-3"><p className="text-xs font-black uppercase tracking-wider text-slate-700">Assistente de suporte</p><p className="mt-1 text-xs text-slate-500">Diga em linguagem simples o que a IA deve fazer. Aprovações e ações protegidas continuam respeitando as regras do sistema.</p></header>
    <div className="max-h-80 space-y-3 overflow-y-auto p-4">
      {ordered.map((item) => { const mine = item.createdById === currentActorId; return <div className={`flex ${mine ? "justify-end" : "justify-start"}`} key={item.id}><div className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm ${mine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-700"}`}><p className={`text-[10px] font-black uppercase tracking-wide ${mine ? "text-blue-100" : "text-slate-400"}`}>{mine ? "Você" : item.createdBy}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-5">{item.note}</p><p className={`mt-2 text-[10px] ${mine ? "text-blue-100" : "text-slate-400"}`}>{new Date(item.createdAt).toLocaleString("pt-BR")}</p></div></div>; })}
      {ordered.length === 0 && <p className="py-6 text-center text-xs text-slate-500">Nenhum evento registrado.</p>}
    </div>
    <form className="border-t border-slate-200 bg-white p-3" onSubmit={submit}>
      <label className="sr-only" htmlFor={`support-assistant-${ticketId}`}>Mensagem para a IA do G-SIPRO</label>
      <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
        <textarea
          className="min-h-12 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
          disabled={busy}
          id={`support-assistant-${ticketId}`}
          maxLength={2_000}
          minLength={3}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ex.: IA, verifique este chamado e faça a correção necessária."
          required
          value={message}
        />
        <button className="shrink-0 rounded-lg bg-brand px-4 py-3 text-xs font-bold text-white disabled:opacity-50" disabled={busy || message.trim().length < 3} type="submit">{busy ? "Enviando…" : "Enviar para a IA"}</button>
      </div>
      {feedback && <p className="mt-2 text-xs font-semibold text-slate-600" role="status">{feedback}</p>}
      <p className="mt-2 text-[10px] leading-4 text-slate-500">A IA registra o pedido, executa pela fila segura e publica aqui o andamento, os testes e o resultado. Você só será chamado quando houver uma aprovação ou ação externa exclusiva.</p>
    </form>
  </section>;
}
