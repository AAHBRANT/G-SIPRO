"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function AnalysisForm({ requirementId, users }: { requirementId: string; users: readonly { id: string; name: string }[] }) {
  const router = useRouter(); const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/requirements/${requirementId}/analyses`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ competence: form.get("competence"), priority: form.get("priority"), assigneeId: form.get("assigneeId") }) });
    const result = await response.json() as { error?: { message?: string } }; setMessage(response.ok ? "Análise distribuída." : result.error?.message ?? "Falha na distribuição."); if (response.ok) router.refresh();
  }
  return <form className="mt-4 grid gap-2 border-t border-border pt-4 md:grid-cols-4" onSubmit={submit}>
    <select className="rounded-lg border border-border px-2 py-2 text-sm" name="competence"><option value="TECHNICAL">Técnica</option><option value="LEGAL">Jurídica</option><option value="COMMERCIAL">Comercial</option><option value="FINANCIAL">Financeira</option><option value="ACCOUNTING">Contábil</option></select>
    <select className="rounded-lg border border-border px-2 py-2 text-sm" name="priority"><option value="NORMAL">Prioridade normal</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option><option value="LOW">Baixa</option></select>
    <select className="rounded-lg border border-border px-2 py-2 text-sm" name="assigneeId">{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select>
    <button className="rounded-lg border border-brand px-3 py-2 text-sm font-bold text-brand">Distribuir</button>
    {message && <span className="text-xs text-muted md:col-span-4" role="status">{message}</span>}
  </form>;
}
