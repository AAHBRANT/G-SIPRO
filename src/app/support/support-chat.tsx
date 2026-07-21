"use client";

import { useMemo } from "react";

export type SupportChatMessage = {
  id: string;
  note: string;
  createdAt: string;
  createdBy: string;
  createdById?: string | null;
};

export function SupportChat({ messages, currentActorId }: { ticketId: string; messages: SupportChatMessage[]; currentActorId: string }) {
  const ordered = useMemo(() => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()), [messages]);

  return <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
    <header className="border-b border-slate-200 bg-white px-4 py-3"><p className="text-xs font-black uppercase tracking-wider text-slate-700">Histórico do atendimento</p><p className="mt-1 text-xs text-slate-500">Registro objetivo das decisões, perguntas, respostas e entregas do chamado.</p></header>
    <div className="max-h-80 space-y-3 overflow-y-auto p-4">
      {ordered.map((item) => { const mine = item.createdById === currentActorId; return <div className={`flex ${mine ? "justify-end" : "justify-start"}`} key={item.id}><div className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm ${mine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-700"}`}><p className={`text-[10px] font-black uppercase tracking-wide ${mine ? "text-blue-100" : "text-slate-400"}`}>{mine ? "Você" : item.createdBy}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-5">{item.note}</p><p className={`mt-2 text-[10px] ${mine ? "text-blue-100" : "text-slate-400"}`}>{new Date(item.createdAt).toLocaleString("pt-BR")}</p></div></div>; })}
      {ordered.length === 0 && <p className="py-6 text-center text-xs text-slate-500">Nenhum evento registrado.</p>}
    </div>
  </section>;
}
