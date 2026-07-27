"use client";

import { useEffect, useState, type FormEvent } from "react";

type AttractivenessPoint = Readonly<{
  id: string;
  category: "QUALITATIVE" | "QUANTITATIVE";
  description: string;
  amount: number | null;
  createdAt: string;
}>;

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function AttractivenessTab({ opportunityId, canRegister }: { opportunityId: string; canRegister: boolean }) {
  const [points, setPoints] = useState<readonly AttractivenessPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<"QUALITATIVE" | "QUANTITATIVE">("QUANTITATIVE");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const response = await fetch(`/api/opportunities/${opportunityId}/attractiveness-points`);
      const result = await response.json().catch(() => ({})) as { data?: AttractivenessPoint[] };
      if (active) {
        setPoints(response.ok ? result.data ?? [] : []);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [opportunityId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const description = form.get("description")?.toString().trim() ?? "";
    const amountRaw = form.get("amount")?.toString().trim();
    setBusy(true);
    setMessage("Registrando ponto de atratividade…");
    const response = await fetch(`/api/opportunities/${opportunityId}/attractiveness-points`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        category,
        description,
        ...(category === "QUANTITATIVE" && amountRaw && { amount: Number(amountRaw) }),
      }),
    });
    const result = await response.json().catch(() => ({})) as { data?: AttractivenessPoint; error?: { message?: string } };
    setBusy(false);
    if (!response.ok) {
      setMessage(result.error?.message ?? "Não foi possível registrar o ponto.");
      return;
    }
    setMessage("Ponto registrado.");
    formElement.reset();
    setPoints((current) => [result.data!, ...current]);
  }

  const quantitative = points.filter((item) => item.category === "QUANTITATIVE");
  const qualitative = points.filter((item) => item.category === "QUALITATIVE");
  const total = quantitative.reduce((sum, item) => sum + (item.amount ?? 0), 0);

  return (
    <div className="space-y-5">
      <p className="text-xs leading-5 text-slate-500">Registre, ponto a ponto, o que torna esta oportunidade atrativa — preço praticado abaixo do mercado, economia de estrutura, acervo técnico para obras futuras etc. Sem fórmula automática: cada ponto é avaliado e valorado manualmente por quem registra.</p>

      {canRegister && (
        <form className="rounded-xl border border-slate-200 bg-slate-50 p-5" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-bold text-slate-700">Tipo
              <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal" onChange={(event) => setCategory(event.target.value as "QUALITATIVE" | "QUANTITATIVE")} value={category}>
                <option value="QUANTITATIVE">Quantitativo (dá para precificar)</option>
                <option value="QUALITATIVE">Qualitativo (não dá para precificar)</option>
              </select>
            </label>
            {category === "QUANTITATIVE" && (
              <label className="grid gap-1 text-xs font-bold text-slate-700">Valor estimado (R$)
                <input className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal" min="0" name="amount" required step="0.01" type="number"/>
              </label>
            )}
            <label className="grid gap-1 text-xs font-bold text-slate-700 sm:col-span-2">Descrição
              <textarea className="min-h-20 rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal" maxLength={1000} minLength={5} name="description" placeholder="Ex.: preço ofertado é R$ 5.000/m², conseguimos fazer por R$ 3.000/m²." required/>
            </label>
          </div>
          <button className="mt-4 rounded-lg bg-brand px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50" disabled={busy} type="submit">{busy ? "Registrando…" : "Adicionar ponto"}</button>
          {message && <p aria-live="polite" className="mt-3 text-xs font-semibold text-slate-600" role="status">{message}</p>}
        </form>
      )}

      {loading ? (
        <p className="text-xs text-slate-500">Carregando pontos registrados…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Quantitativos</h3>
              {quantitative.length > 0 && <span className="text-sm font-black text-emerald-700">{currency(total)}</span>}
            </div>
            <ul className="mt-3 space-y-3">
              {quantitative.map((item) => (
                <li className="rounded-lg bg-slate-50 p-3" key={item.id}>
                  <p className="text-sm font-black text-emerald-700">{currency(item.amount ?? 0)}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{item.description}</p>
                </li>
              ))}
              {quantitative.length === 0 && <p className="text-xs text-slate-400">Nenhum ponto quantitativo registrado.</p>}
            </ul>
          </section>
          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Qualitativos</h3>
            <ul className="mt-3 space-y-3">
              {qualitative.map((item) => (
                <li className="rounded-lg bg-slate-50 p-3" key={item.id}>
                  <p className="text-xs leading-5 text-slate-600">{item.description}</p>
                </li>
              ))}
              {qualitative.length === 0 && <p className="text-xs text-slate-400">Nenhum ponto qualitativo registrado.</p>}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
