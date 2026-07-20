"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ProposalVersionForm({ proposalId, nextVersion }: { proposalId: string; nextVersion: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true); setMessage("");
    const response = await fetch(`/api/proposals/${proposalId}/versions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: new FormData(form).get("reason") }) });
    const result = await response.json() as { error?: { message?: string } };
    setBusy(false); setMessage(response.ok ? `Versão ${nextVersion} criada sem alterar as anteriores.` : result.error?.message ?? "Falha ao criar versão.");
    if (response.ok) { form.reset(); router.refresh(); }
  }
  return <form className="mt-4 grid gap-2 rounded-xl border border-border p-4" onSubmit={submit}><label className="grid gap-1 text-sm font-bold">Justificativa da nova versão<textarea className="min-h-20 rounded-xl border border-border px-3 py-2 font-normal" minLength={10} maxLength={1000} name="reason" required /></label><button className="w-fit rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white" disabled={busy}>{busy ? "Criando…" : `Criar versão ${nextVersion}`}</button>{message && <p className="text-xs text-muted" role="status">{message}</p>}</form>;
}
