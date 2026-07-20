"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function MatrixForm({ sources }: { sources: ReadonlyArray<{ id: string; label: string; requirements: number }> }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    const response = await fetch("/api/compliance-matrices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenderVersionId: form.get("tenderVersionId"), analysisReference: form.get("analysisReference") }) });
    const result = await response.json() as { error?: { message?: string } };
    setBusy(false);
    setMessage(response.ok ? "Matriz criada com todos os requisitos validados." : result.error?.message ?? "Falha na criação da matriz.");
    if (response.ok) { formElement.reset(); router.refresh(); }
  }
  return <form className="grid gap-4 rounded-2xl border border-border bg-surface p-6" onSubmit={submit}><h2 className="text-xl font-bold">Criar versão inicial da matriz</h2>{sources.length > 0 ? <><label className="grid gap-1 text-sm font-bold">Versão validada do edital<select className="rounded-xl border border-border bg-background px-3 py-2 font-normal" name="tenderVersionId" required>{sources.map(source => <option key={source.id} value={source.id}>{source.label} · {source.requirements} requisito(s)</option>)}</select></label><label className="grid gap-1 text-sm font-bold">Referência da análise<input className="rounded-xl border border-border bg-background px-3 py-2 font-normal" maxLength={160} minLength={3} name="analysisReference" placeholder="Ex.: Análise técnica inicial" required /></label><button className="w-fit rounded-xl bg-brand px-5 py-2.5 font-bold text-white" disabled={busy}>{busy ? "Criando…" : "Criar matriz rastreável"}</button></> : <p className="text-sm text-muted">Nenhuma versão está pronta. Valide as análises e depois os requisitos do edital.</p>}{message && <p className="text-sm text-muted" role="status">{message}</p>}</form>;
}

