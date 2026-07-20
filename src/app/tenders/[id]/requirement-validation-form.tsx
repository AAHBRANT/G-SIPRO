"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function RequirementValidationForm({ requirementId }: { requirementId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const response = await fetch(`/api/requirements/${requirementId}/validate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ justification: form.get("justification") }) });
    const result = await response.json() as { error?: { message?: string } };
    setBusy(false);
    setMessage(response.ok ? "Requisito validado e liberado para matriz." : result.error?.message ?? "Falha na validação.");
    if (response.ok) router.refresh();
  }
  return <form className="mt-3 flex flex-wrap gap-2" onSubmit={submit}><input className="min-w-64 flex-1 rounded-lg border border-border px-3 py-2 text-xs" minLength={10} name="justification" placeholder="Justificativa da validação do requisito" required /><button className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white" disabled={busy}>{busy ? "Validando…" : "Validar requisito"}</button>{message && <span className="w-full text-xs text-muted" role="status">{message}</span>}</form>;
}

