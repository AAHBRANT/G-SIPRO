"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Decisão humana sobre uma licitação rastreada. Aprovar cria a oportunidade e
 * leva direto a ela; descartar exige motivo, que fica registrado no histórico.
 */
export function TriageActions({ id }: { id: string }) {
  const router = useRouter();
  const [discarding, setDiscarding] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function decide(body: Record<string, unknown>, onDone: (payload: { opportunityId?: string }) => void) {
    setError(undefined);
    startTransition(async () => {
      const response = await fetch(`/api/scouting/scouted-tenders/${id}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(response.status === 409 ? "Esta licitação já foi triada." : "Não foi possível registrar a decisão.");
        return;
      }
      const payload = await response.json().catch(() => ({ data: {} }));
      onDone(payload.data ?? {});
    });
  }

  if (discarding) {
    return <div className="flex flex-col gap-2">
      <label className="sr-only" htmlFor={`reason-${id}`}>Motivo do descarte</label>
      <input
        autoFocus
        className="h-8 w-full rounded-md border border-slate-200 px-2 text-[11px] outline-none focus:border-brand"
        id={`reason-${id}`}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Motivo do descarte"
        value={reason}
      />
      <div className="flex gap-1.5">
        <button
          className="rounded-md bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
          disabled={pending || reason.trim().length < 3}
          onClick={() => decide({ decision: "DISCARD", reason: reason.trim() }, () => router.refresh())}
          type="button"
        >Confirmar</button>
        <button className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600" onClick={() => { setDiscarding(false); setReason(""); }} type="button">Cancelar</button>
      </div>
      {error && <span className="text-[10px] text-brand">{error}</span>}
    </div>;
  }

  return <div className="flex flex-col items-center gap-1">
    <div className="flex justify-center gap-1.5">
      <button
        className="rounded-md bg-brand px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[var(--brand-strong)] disabled:opacity-50"
        disabled={pending}
        onClick={() => decide({ decision: "APPROVE" }, (payload) => {
          if (payload.opportunityId) router.push(`/opportunities/${payload.opportunityId}`);
          else router.refresh();
        })}
        type="button"
      >{pending ? "…" : "Aprovar"}</button>
      <button className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50" disabled={pending} onClick={() => setDiscarding(true)} type="button">Descartar</button>
    </div>
    {error && <span className="text-[10px] text-brand">{error}</span>}
  </div>;
}
