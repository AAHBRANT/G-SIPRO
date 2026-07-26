"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { OpportunityFormFields, type OpportunityFormValues } from "../opportunity-form-fields";

type Status = "DRAFT" | "QUALIFICATION" | "ACTIVE" | "SUSPENDED" | "CLOSED";
type Drawer = "edit" | "transition" | null;

const transitions: Record<Status, readonly { target: Status; label: string }[]> = {
  DRAFT: [{ target: "QUALIFICATION", label: "Enviar para qualificação" }],
  QUALIFICATION: [
    { target: "ACTIVE", label: "Validar, delegar e gerar proposta" },
    { target: "SUSPENDED", label: "Suspender" },
    { target: "CLOSED", label: "Encerrar" },
  ],
  ACTIVE: [
    { target: "SUSPENDED", label: "Suspender" },
    { target: "CLOSED", label: "Encerrar" },
  ],
  SUSPENDED: [
    { target: "ACTIVE", label: "Reativar proposta" },
    { target: "CLOSED", label: "Encerrar" },
  ],
  CLOSED: [{ target: "QUALIFICATION", label: "Reabrir para qualificação" }],
};

export type OpportunityEditorData = OpportunityFormValues & Readonly<{
  id: string;
  code: string;
  origin: string;
  status: Status;
}>;

export function OpportunityEditor({
  opportunity,
  users,
  canUpdate,
  canTransition,
}: {
  opportunity: OpportunityEditorData;
  users: readonly { id: string; name: string }[];
  canUpdate: boolean;
  canTransition: boolean;
}) {
  const router = useRouter();
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<Status>(transitions[opportunity.status][0]?.target ?? opportunity.status);

  function openTransitionDrawer() {
    setTarget(transitions[opportunity.status][0]?.target ?? opportunity.status);
    setDrawer("transition");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    const payload = Object.fromEntries(
      ["origin", "subject", "estimatedValue", "currency", "valueSource", "publishedAt", "deliveryAt", "datesSource", "datesTimeZone", "ownerId"]
        .map((field) => [field, form.get(field)?.toString().trim()])
        .filter(([, value]) => value),
    );
    try {
      const response = await fetch(`/api/opportunities/${opportunity.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: { message?: string } };
      setBusy(false);
      if (response.ok) {
        setMessage("Oportunidade atualizada.");
        setDrawer(null);
        router.refresh();
        return;
      }
      setMessage(result.error?.message ?? "Falha ao salvar.");
    } catch {
      setBusy(false);
      setMessage("Falha de conexão. Verifique sua rede e tente novamente.");
    }
  }

  async function transition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    const targetStatus = form.get("target");
    try {
      const response = await fetch(`/api/opportunities/${opportunity.id}/transition`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          target: targetStatus,
          closureReasonCode: form.get("closureReasonCode") || undefined,
          closureJustification: form.get("closureJustification") || undefined,
          reason: form.get("reason") || undefined,
          ownerId: form.get("ownerId") || undefined,
        }),
      });
      const result = (await response.json()) as { error?: { message?: string } };
      setBusy(false);
      if (response.ok) {
        setMessage(targetStatus === "ACTIVE" ? "Oportunidade validada, delegada e convertida em proposta." : "Situação atualizada.");
        setDrawer(null);
        router.refresh();
        return;
      }
      setMessage(result.error?.message ?? "Falha na movimentação.");
    } catch {
      setBusy(false);
      setMessage("Falha de conexão. Verifique sua rede e tente novamente.");
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {canUpdate && (
          <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50" onClick={() => setDrawer("edit")} type="button">
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"/><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125 16.875 4.5M18 13.5v6.75A1.75 1.75 0 0 1 16.25 22h-12.5A1.75 1.75 0 0 1 2 20.25V7.75A1.75 1.75 0 0 1 3.75 6H10.5"/></svg>
            Editar oportunidade
          </button>
        )}
        {canTransition && (
          <button className="rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[var(--brand-strong)]" onClick={openTransitionDrawer} type="button">
            Validar e avançar
          </button>
        )}
        {message && <p className="text-xs font-semibold text-brand" role="status">{message}</p>}
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 bg-slate-950/35" onMouseDown={(event) => { if (event.target === event.currentTarget) setDrawer(null); }}>
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label={drawer === "edit" ? "Editar oportunidade" : "Validar e avançar"}>
            <header className="flex items-start justify-between border-b border-slate-200 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brand">{opportunity.code}</p>
                <h2 className="mt-1 text-xl font-black">{drawer === "edit" ? "Editar oportunidade" : "Validar e avançar"}</h2>
                <p className="mt-1 text-xs text-slate-500">{drawer === "edit" ? "O mesmo cadastro acompanha todas as etapas." : "Defina o próximo passo e, quando aplicável, delegue a proposta."}</p>
              </div>
              <button aria-label="Fechar painel" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" onClick={() => setDrawer(null)} type="button">✕</button>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              {drawer === "edit" ? (
                <form className="grid gap-5" onSubmit={save}>
                  <OpportunityFormFields values={opportunity} users={users} />
                  <button className="w-fit rounded-xl bg-brand px-5 py-2.5 font-bold text-white disabled:opacity-60" disabled={busy}>
                    {busy ? "Salvando…" : "Salvar alterações"}
                  </button>
                </form>
              ) : (
                <form className="grid gap-4" onSubmit={transition}>
                  {opportunity.status === "QUALIFICATION" && <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900">Ao validar, a oportunidade será convertida em proposta, os documentos serão preservados e a demanda será delegada.</p>}
                  {(opportunity.status === "QUALIFICATION" || opportunity.status === "SUSPENDED") && (
                    <label className="grid gap-1 text-sm font-semibold">
                      Delegar proposta para
                      <select className="rounded-xl border border-border px-3 py-2 font-normal" name="ownerId" defaultValue={opportunity.ownerId ?? ""} required>
                        <option value="">Selecione o responsável</option>
                        {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                      </select>
                    </label>
                  )}
                  <label className="grid gap-1 text-sm font-semibold">
                    Próxima situação
                    <select className="rounded-xl border border-border px-3 py-2 font-normal" name="target" onChange={(event) => setTarget(event.target.value as Status)} value={target}>
                      {transitions[opportunity.status].map((entry) => <option key={entry.target} value={entry.target}>{entry.label}</option>)}
                    </select>
                  </label>
                  {target === "CLOSED" && (
                    <>
                      <label className="grid gap-1 text-sm font-semibold">
                        Motivo padronizado de encerramento
                        <select className="rounded-xl border border-border px-3 py-2 font-normal" name="closureReasonCode" defaultValue="">
                          <option value="">Não aplicável</option><option value="WON">Ganha</option><option value="LOST">Perdida</option>
                          <option value="NO_GO">Não participar</option><option value="CANCELLED">Cancelada pelo demandante</option><option value="OTHER">Outro</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-sm font-semibold">
                        Justificativa de encerramento
                        <textarea className="min-h-20 rounded-xl border border-border px-3 py-2 font-normal" name="closureJustification" />
                      </label>
                    </>
                  )}
                  {opportunity.status === "CLOSED" && (
                    <label className="grid gap-1 text-sm font-semibold">
                      Motivo da reabertura
                      <textarea className="min-h-20 rounded-xl border border-border px-3 py-2 font-normal" name="reason" />
                    </label>
                  )}
                  <button className="w-fit rounded-xl bg-brand px-5 py-2.5 font-bold text-white disabled:opacity-60" disabled={busy}>
                    {busy ? "Processando…" : "Confirmar movimentação"}
                  </button>
                </form>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
