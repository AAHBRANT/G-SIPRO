"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportClarification } from "@/modules/support/domain/support-ticket";

export function SupportValidation({ ticketId, attempt, clarification }: { ticketId: string; attempt: number; clarification?: SupportClarification | null }) {
  const router = useRouter();
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [other, setOther] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function send(payload: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}/validation`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined;
      if (!response.ok) throw new Error(result?.error?.message ?? "Não foi possível registrar a validação.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível registrar a validação.");
    } finally {
      setBusy(false);
    }
  }

  if (clarification) {
    const answers = clarification.questions.map(question => ({ questionId: question.id, answer: selected[question.id] === "__OTHER__" ? (other[question.id] ?? "").trim() : selected[question.id] })).filter(answer => answer.answer);
    const complete = answers.length === clarification.questions.length;
    return <section className="mt-5 rounded-xl border-2 border-violet-200 bg-violet-50/50 p-5">
      <p className="text-xs font-black uppercase tracking-wider text-violet-700">Esclarecimento orientado pela GUULY</p>
      <h4 className="mt-1 text-lg font-black text-slate-950">Precisamos de informações objetivas</h4>
      <p className="mt-2 text-sm text-slate-700">{clarification.introduction}</p>
      <p className="mt-2 text-xs font-bold text-slate-500">A GUULY fará no máximo cinco perguntas. Isto não é um bate-papo.</p>
      <div className="mt-5 grid gap-5">{clarification.questions.map((question, index) => <fieldset className="rounded-xl border border-violet-100 bg-white p-4" key={question.id}>
        <legend className="px-1 text-sm font-black text-slate-900">{index + 1}. {question.question}</legend>
        <div className="mt-3 grid gap-2">{[...question.options, "__OTHER__"].map(option => <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700" key={option}><input checked={selected[question.id] === option} name={question.id} onChange={() => setSelected(current => ({ ...current, [question.id]: option }))} type="radio"/><span>{option === "__OTHER__" ? "Outra" : option}</span></label>)}</div>
        {selected[question.id] === "__OTHER__" && <textarea className="mt-3 min-h-20 w-full rounded-lg border border-slate-200 p-3 text-sm" maxLength={1000} onChange={event => setOther(current => ({ ...current, [question.id]: event.target.value }))} placeholder="Descreva de forma objetiva" value={other[question.id] ?? ""}/>}
      </fieldset>)}</div>
      <button className="mt-5 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={busy || !complete} onClick={() => send({ action: "SUBMIT_CLARIFICATION", answers })}>{busy ? "Registrando…" : attempt >= 3 ? "Enviar ao proprietário" : "Enviar para nova tentativa"}</button>
      {message && <p className="mt-3 text-sm font-semibold text-rose-700">{message}</p>}
    </section>;
  }

  return <section className="mt-5 rounded-xl border-2 border-amber-300 bg-amber-50 p-5">
    <p className="text-xs font-black uppercase tracking-wider text-amber-800">Validação do solicitante · tentativa {attempt} de 3</p>
    <h4 className="mt-2 text-xl font-black text-slate-950">Posso encerrar este chamado?</h4>
    <p className="mt-2 text-sm text-slate-700">Confirme somente após repetir a operação que apresentou o problema.</p>
    {!showReason ? <div className="mt-5 flex flex-wrap gap-3"><button className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={busy} onClick={() => send({ action: "CONFIRM_RESOLVED" })}>Sim, problema resolvido</button><button className="rounded-xl border border-rose-300 bg-white px-5 py-3 text-sm font-bold text-rose-700" disabled={busy} onClick={() => setShowReason(true)}>Não, ainda ocorre</button></div> : <div className="mt-5"><label className="grid gap-2 text-sm font-bold text-slate-800">Por que o problema não foi resolvido?<textarea className="min-h-24 rounded-xl border border-amber-300 bg-white p-3 font-normal" maxLength={2000} minLength={5} onChange={event => setReason(event.target.value)} placeholder="Explique o que aconteceu ao testar novamente" value={reason}/></label><div className="mt-3 flex gap-3"><button className="rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={busy || reason.trim().length < 5} onClick={() => send({ action: "REPORT_UNRESOLVED", reason })}>{busy ? "Preparando perguntas…" : "Continuar"}</button><button className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold" onClick={() => setShowReason(false)}>Voltar</button></div></div>}
    {message && <p className="mt-3 text-sm font-semibold text-rose-700">{message}</p>}
  </section>;
}
