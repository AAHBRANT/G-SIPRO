"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type ResponsibleOption = Readonly<{ id: string; label: string }>;

export function ItemAssessmentForm({ itemId, responsibles }: { itemId: string; responsibles: ReadonlyArray<ResponsibleOption> }) {
  const router = useRouter();
  const [decision, setDecision] = useState("MEETS");
  const [hasTreatment, setHasTreatment] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const treatmentRequired = decision === "PARTIAL" || decision === "DOES_NOT_MEET";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const includeTreatment = treatmentRequired || hasTreatment;
    const dueValue = String(form.get("dueAt") ?? "");
    const body = { decision, justification: form.get("justification"), ...(includeTreatment ? { gapDescription: form.get("gapDescription"), riskDescription: form.get("riskDescription"), impact: form.get("impact"), treatment: form.get("treatment"), responsibleId: form.get("responsibleId"), dueAt: new Date(dueValue).toISOString() } : {}) };
    setBusy(true);
    const response = await fetch(`/api/compliance-matrices/items/${itemId}/validation`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as { error?: { message?: string } };
    setBusy(false);
    setMessage(response.ok ? "Validação técnica registrada em nova versão." : result.error?.message ?? "Falha ao registrar validação.");
    if (response.ok) { formElement.reset(); setDecision("MEETS"); setHasTreatment(false); router.refresh(); }
  }

  return <form className="mt-4 grid gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4" onSubmit={submit}>
    <h4 className="text-sm font-bold">Validação técnica humana</h4>
    <div className="grid gap-3 md:grid-cols-2"><label className="grid gap-1 text-xs font-bold">Decisão<select className="rounded-lg border border-border px-3 py-2 font-normal" name="decision" onChange={event => { const value = event.target.value; setDecision(value); if (value === "PARTIAL" || value === "DOES_NOT_MEET") setHasTreatment(true); }} value={decision}><option value="MEETS">Atende</option><option value="PARTIAL">Atende parcialmente</option><option value="DOES_NOT_MEET">Não atende</option><option value="NOT_APPLICABLE">Não aplicável</option></select></label><label className="grid gap-1 text-xs font-bold">Justificativa técnica<textarea className="min-h-20 rounded-lg border border-border px-3 py-2 font-normal" maxLength={4000} minLength={10} name="justification" required /></label></div>
    {!treatmentRequired && <label className="flex items-center gap-2 text-xs font-bold"><input checked={hasTreatment} onChange={event => setHasTreatment(event.target.checked)} type="checkbox" />Registrar risco ou lacuna residual</label>}
    {(treatmentRequired || hasTreatment) && <div className="grid gap-3 rounded-lg bg-white p-3"><div className="grid gap-3 md:grid-cols-2"><label className="grid gap-1 text-xs font-bold">Lacuna<textarea className="min-h-16 rounded-lg border border-border px-3 py-2 font-normal" maxLength={2000} minLength={10} name="gapDescription" required /></label><label className="grid gap-1 text-xs font-bold">Risco<textarea className="min-h-16 rounded-lg border border-border px-3 py-2 font-normal" maxLength={2000} minLength={10} name="riskDescription" required /></label><label className="grid gap-1 text-xs font-bold">Impacto<textarea className="min-h-16 rounded-lg border border-border px-3 py-2 font-normal" maxLength={2000} minLength={10} name="impact" required /></label><label className="grid gap-1 text-xs font-bold">Tratamento<textarea className="min-h-16 rounded-lg border border-border px-3 py-2 font-normal" maxLength={2000} minLength={10} name="treatment" required /></label></div><div className="grid gap-3 md:grid-cols-2"><label className="grid gap-1 text-xs font-bold">Responsável<select className="rounded-lg border border-border px-3 py-2 font-normal" name="responsibleId" required><option value="">Selecione</option>{responsibles.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><label className="grid gap-1 text-xs font-bold">Prazo definido pelo responsável<input className="rounded-lg border border-border px-3 py-2 font-normal" min={new Date().toISOString().slice(0, 16)} name="dueAt" required type="datetime-local" /></label></div></div>}
    <button className="w-fit rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white" disabled={busy || ((treatmentRequired || hasTreatment) && responsibles.length === 0)}>{busy ? "Registrando…" : "Registrar validação"}</button>
    {message && <p className="text-xs text-muted" role="status">{message}</p>}
  </form>;
}

