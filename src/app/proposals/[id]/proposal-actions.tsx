"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Action = "FINALIZED" | "CANCELLED" | "DELETE";

export function ProposalActions({
  proposalId,
  proposalCode,
  canManageStatus,
  canDelete,
  terminal,
  cancelled,
}: {
  proposalId: string;
  proposalCode: string;
  canManageStatus: boolean;
  canDelete: boolean;
  terminal: boolean;
  cancelled: boolean;
}) {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function confirmAction() {
    if (!action || reason.trim().length < 5) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/proposals/${proposalId}${action === "DELETE" ? "" : "/status"}`, {
        method: action === "DELETE" ? "DELETE" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action === "DELETE" ? { reason } : { status: action, reason }),
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      setBusy(false);
      if (!response.ok) {
        setMessage(payload.error?.message ?? "Não foi possível concluir.");
        return;
      }
      setAction(null);
      setReason("");
      router.refresh();
      if (action === "DELETE") router.push("/proposals");
    } catch {
      setBusy(false);
      setMessage("Falha de conexão. Verifique sua rede e tente novamente.");
    }
  }

  if (!canManageStatus && !canDelete) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {canManageStatus && !terminal && !cancelled && (
          <button className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50" onClick={() => setAction("FINALIZED")} type="button">Finalizar</button>
        )}
        {canManageStatus && !terminal && !cancelled && (
          <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50" onClick={() => setAction("CANCELLED")} type="button">Cancelar</button>
        )}
        {canDelete && !terminal && (
          <button className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50" onClick={() => setAction("DELETE")} type="button">Excluir</button>
        )}
      </div>

      {action && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-black text-slate-900">{action === "DELETE" ? "Excluir proposta" : action === "CANCELLED" ? "Cancelar proposta" : "Finalizar proposta"}</h3>
            <p className="mt-2 text-sm text-slate-500">{proposalCode}</p>
            <label className="mt-4 grid gap-2 text-sm font-bold text-slate-700">
              Motivo
              <textarea className="min-h-24 rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" onChange={(event) => setReason(event.target.value)} value={reason} />
            </label>
            {message && <p className="mt-2 text-xs font-bold text-rose-700">{message}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold" onClick={() => { setAction(null); setReason(""); setMessage(""); }} type="button">Voltar</button>
              <button className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={busy || reason.trim().length < 5} onClick={confirmAction} type="button">{busy ? "Processando…" : "Confirmar"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
