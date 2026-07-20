"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Status = "DRAFT" | "QUALIFICATION" | "ACTIVE" | "SUSPENDED" | "CLOSED";

const transitions: Record<Status, readonly { target: Status; label: string }[]> = {
  DRAFT: [{ target: "QUALIFICATION", label: "Enviar para qualificação" }],
  QUALIFICATION: [
    { target: "ACTIVE", label: "Ativar" },
    { target: "SUSPENDED", label: "Suspender" },
    { target: "CLOSED", label: "Encerrar" },
  ],
  ACTIVE: [
    { target: "SUSPENDED", label: "Suspender" },
    { target: "CLOSED", label: "Encerrar" },
  ],
  SUSPENDED: [
    { target: "ACTIVE", label: "Reativar" },
    { target: "CLOSED", label: "Encerrar" },
  ],
  CLOSED: [{ target: "QUALIFICATION", label: "Reabrir para qualificação" }],
};

export type OpportunityEditorData = Readonly<{
  id: string;
  code: string;
  origin: string;
  subject?: string;
  estimatedValue?: string;
  currency?: string;
  valueSource?: string;
  publishedAt?: string;
  deliveryAt?: string;
  datesSource?: string;
  datesTimeZone?: string;
  ownerId?: string;
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
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    const payload = Object.fromEntries(
      ["subject", "estimatedValue", "currency", "valueSource", "publishedAt", "deliveryAt", "datesSource", "datesTimeZone", "ownerId"]
        .map((field) => [field, form.get(field)?.toString().trim()])
        .filter(([, value]) => value),
    );
    const response = await fetch(`/api/opportunities/${opportunity.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { error?: { message?: string } };
    setBusy(false);
    setMessage(response.ok ? "Alterações salvas e versionadas." : result.error?.message ?? "Falha ao salvar.");
    if (response.ok) router.refresh();
  }

  async function transition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/opportunities/${opportunity.id}/transition`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target: form.get("target"),
        closureReasonCode: form.get("closureReasonCode") || undefined,
        closureJustification: form.get("closureJustification") || undefined,
        reason: form.get("reason") || undefined,
      }),
    });
    const result = (await response.json()) as { error?: { message?: string } };
    setBusy(false);
    setMessage(response.ok ? "Situação alterada e auditada." : result.error?.message ?? "Falha na transição.");
    if (response.ok) router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
      <form className="grid gap-4 rounded-2xl border border-border bg-surface p-6 shadow-sm" onSubmit={save}>
        <h2 className="text-xl font-bold">Dados da oportunidade</h2>
        <label className="grid gap-1 text-sm font-semibold">Objeto
          <textarea className="min-h-28 rounded-xl border border-border px-3 py-2 font-normal" name="subject" defaultValue={opportunity.subject} disabled={!canUpdate} />
        </label>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-1 text-sm font-semibold">Valor estimado
            <input className="rounded-xl border border-border px-3 py-2 font-normal" name="estimatedValue" type="number" min="0" step="0.01" defaultValue={opportunity.estimatedValue} disabled={!canUpdate} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">Moeda
            <input className="rounded-xl border border-border px-3 py-2 font-normal uppercase" name="currency" maxLength={3} defaultValue={opportunity.currency ?? "BRL"} disabled={!canUpdate} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">Fonte do valor
            <input className="rounded-xl border border-border px-3 py-2 font-normal" name="valueSource" defaultValue={opportunity.valueSource} disabled={!canUpdate} />
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">Publicação
            <input className="rounded-xl border border-border px-3 py-2 font-normal" name="publishedAt" type="datetime-local" defaultValue={opportunity.publishedAt} disabled={!canUpdate} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">Entrega
            <input className="rounded-xl border border-border px-3 py-2 font-normal" name="deliveryAt" type="datetime-local" defaultValue={opportunity.deliveryAt} disabled={!canUpdate} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">Fonte das datas
            <input className="rounded-xl border border-border px-3 py-2 font-normal" name="datesSource" defaultValue={opportunity.datesSource} disabled={!canUpdate} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">Fuso das datas
            <input className="rounded-xl border border-border px-3 py-2 font-normal" name="datesTimeZone" defaultValue={opportunity.datesTimeZone ?? "America/Sao_Paulo"} disabled={!canUpdate} />
          </label>
        </div>
        <label className="grid gap-1 text-sm font-semibold">Responsável
          <select className="rounded-xl border border-border px-3 py-2 font-normal" name="ownerId" defaultValue={opportunity.ownerId ?? ""} disabled={!canUpdate}>
            <option value="">Não definido</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
        </label>
        {canUpdate && <button className="w-fit rounded-xl bg-brand px-5 py-2.5 font-bold text-white disabled:opacity-60" disabled={busy}>Salvar alterações</button>}
      </form>

      {canTransition && (
        <form className="h-fit grid gap-4 rounded-2xl border border-border bg-surface p-6 shadow-sm" onSubmit={transition}>
          <h2 className="text-xl font-bold">Movimentar ciclo</h2>
          <label className="grid gap-1 text-sm font-semibold">Próxima situação
            <select className="rounded-xl border border-border px-3 py-2 font-normal" name="target">
              {transitions[opportunity.status].map((entry) => <option key={entry.target} value={entry.target}>{entry.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">Motivo padronizado de encerramento
            <select className="rounded-xl border border-border px-3 py-2 font-normal" name="closureReasonCode" defaultValue="">
              <option value="">Não aplicável</option><option value="WON">Ganha</option><option value="LOST">Perdida</option>
              <option value="NO_GO">Não participar</option><option value="CANCELLED">Cancelada pelo demandante</option><option value="OTHER">Outro</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">Justificativa de encerramento
            <textarea className="min-h-20 rounded-xl border border-border px-3 py-2 font-normal" name="closureJustification" />
          </label>
          <label className="grid gap-1 text-sm font-semibold">Motivo da movimentação/reabertura
            <textarea className="min-h-20 rounded-xl border border-border px-3 py-2 font-normal" name="reason" />
          </label>
          <button className="rounded-xl border border-brand px-5 py-2.5 font-bold text-brand disabled:opacity-60" disabled={busy}>Confirmar movimentação</button>
        </form>
      )}
      {message && <p className="text-sm font-semibold text-brand" role="status">{message}</p>}
    </div>
  );
}
