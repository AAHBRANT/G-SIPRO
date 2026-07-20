"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

type EvidenceOption = Readonly<{ id: string; label: string; status: string; quantities: ReadonlyArray<{ id: string; label: string; unit: string }> }>;

export function MatrixEvidenceForm({ itemId, evidence }: { itemId: string; evidence: ReadonlyArray<EvidenceOption> }) {
  const router = useRouter();
  const [evidenceId, setEvidenceId] = useState(evidence[0]?.id ?? "");
  const [quantityId, setQuantityId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const quantities = useMemo(() => evidence.find(option => option.id === evidenceId)?.quantities ?? [], [evidence, evidenceId]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const comparisons = quantityId ? [{ executedQuantityId: quantityId, requiredValue: form.get("requiredValue"), requiredUnit: form.get("requiredUnit"), ...(form.get("conversionFactor") ? { conversionFactor: form.get("conversionFactor"), conversionRule: form.get("conversionRule"), conversionSource: form.get("conversionSource") } : {}) }] : [];
    setBusy(true);
    const response = await fetch(`/api/compliance-matrices/items/${itemId}/evidence`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ technicalEvidenceId: evidenceId, locator: form.get("locator"), justification: form.get("justification"), comparisons }) });
    const result = await response.json() as { error?: { message?: string } };
    setBusy(false);
    setMessage(response.ok ? "Evidência associada com rastreabilidade." : result.error?.message ?? "Falha na associação.");
    if (response.ok) { formElement.reset(); setQuantityId(""); router.refresh(); }
  }
  if (evidence.length === 0) return <p className="mt-3 text-xs text-muted">Nenhuma evidência técnica cadastrada.</p>;
  return <form className="mt-4 grid gap-3 rounded-xl bg-background p-4" onSubmit={submit}><h4 className="text-sm font-bold">Associar evidência</h4><label className="grid gap-1 text-xs font-bold">Evidência<select className="rounded-lg border border-border px-3 py-2 font-normal" name="technicalEvidenceId" onChange={event => { setEvidenceId(event.target.value); setQuantityId(""); }} value={evidenceId}>{evidence.map(option => <option key={option.id} value={option.id}>{option.label} · {option.status}</option>)}</select></label><div className="grid gap-3 md:grid-cols-2"><label className="grid gap-1 text-xs font-bold">Localizador na evidência<input className="rounded-lg border border-border px-3 py-2 font-normal" maxLength={500} name="locator" placeholder="Ex.: página 4, item 2.1" required /></label><label className="grid gap-1 text-xs font-bold">Justificativa<input className="rounded-lg border border-border px-3 py-2 font-normal" maxLength={1000} minLength={10} name="justification" required /></label></div><label className="grid gap-1 text-xs font-bold">Quantitativo comprovado (opcional)<select className="rounded-lg border border-border px-3 py-2 font-normal" name="executedQuantityId" onChange={event => setQuantityId(event.target.value)} value={quantityId}><option value="">Sem comparação quantitativa</option>{quantities.map(quantity => <option key={quantity.id} value={quantity.id}>{quantity.label}</option>)}</select></label>{quantityId && <><div className="grid gap-3 md:grid-cols-2"><label className="grid gap-1 text-xs font-bold">Valor exigido<input className="rounded-lg border border-border px-3 py-2 font-normal" min="0" name="requiredValue" required step="any" type="number" /></label><label className="grid gap-1 text-xs font-bold">Unidade exigida<input className="rounded-lg border border-border px-3 py-2 font-normal" maxLength={40} name="requiredUnit" required /></label></div><details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs font-bold">Conversão documentada (somente se as unidades forem diferentes)</summary><div className="mt-3 grid gap-3 md:grid-cols-3"><label className="grid gap-1 text-xs font-bold">Fator<input className="rounded-lg border border-border px-3 py-2 font-normal" min="0.000000001" name="conversionFactor" step="any" type="number" /></label><label className="grid gap-1 text-xs font-bold">Regra<input className="rounded-lg border border-border px-3 py-2 font-normal" minLength={10} name="conversionRule" /></label><label className="grid gap-1 text-xs font-bold">Fonte da conversão<input className="rounded-lg border border-border px-3 py-2 font-normal" name="conversionSource" /></label></div></details></>}<button className="w-fit rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white" disabled={busy}>{busy ? "Associando…" : "Associar evidência"}</button>{message && <p className="text-xs text-muted" role="status">{message}</p>}</form>;
}

