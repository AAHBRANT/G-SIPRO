"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type KeyboardEvent } from "react";

import { OpportunityFormFields } from "./opportunity-form-fields";

export function CreateOpportunityForm({ users = [] }: { users?: readonly { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [duplicateCandidates, setDuplicateCandidates] = useState<readonly { code: string; reasons: readonly string[] }[]>([]);

  async function suggestCode(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "F4") return;
    event.preventDefault();
    const input = event.currentTarget;
    const prefix = input.value.trim();
    if (!prefix) {
      setMessage("Digite o início do código antes de pressionar F4.");
      return;
    }
    setMessage("Buscando próximo código…");
    try {
      const response = await fetch(`/api/opportunities/next-code?prefix=${encodeURIComponent(prefix)}`);
      const payload = (await response.json()) as { data?: { code?: string }; error?: { message?: string } };
      if (!response.ok || !payload.data?.code) {
        setMessage(payload.error?.message ?? "Não foi possível gerar o código.");
        return;
      }
      input.value = payload.data.code;
      setMessage(`Código sugerido: ${payload.data.code}`);
    } catch {
      setMessage("Falha de conexão ao gerar o código.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitting(true);
    setMessage("");
    const form = new FormData(formElement);
    const fields = ["code", "origin", "subject", "estimatedValue", "currency", "valueSource", "publishedAt", "deliveryAt", "datesSource", "datesTimeZone", "ownerId"];
    try {
      const response = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...Object.fromEntries(
            fields
              .map((field) => [field, form.get(field)?.toString().trim()])
              .filter(([, value]) => value),
          ),
          ...(duplicateCandidates.length > 0 && {
            duplicateDecision: "CREATE_SEPARATE",
            duplicateJustification: form.get("duplicateJustification"),
          }),
        }),
      });
      const payload = (await response.json()) as {
        warning?: string;
        error?: {
          message?: string;
          details?: { code?: string; candidates?: readonly { code: string; reasons: readonly string[] }[] };
        };
      };
      setSubmitting(false);
      if (!response.ok) {
        if (payload.error?.details?.code === "POSSIBLE_DUPLICATE" && payload.error.details.candidates) {
          setDuplicateCandidates(payload.error.details.candidates);
        }
        setMessage(payload.error?.message ?? "Não foi possível cadastrar a oportunidade.");
        return;
      }
      formElement.reset();
      setDuplicateCandidates([]);
      router.refresh();
      if (payload.warning) {
        setMessage(payload.warning);
      } else {
        setMessage("");
        setOpen(false);
      }
    } catch {
      setSubmitting(false);
      setMessage("Falha de conexão. Verifique sua rede e tente novamente.");
    }
  }

  return (
    <>
      <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--brand-strong)]" onClick={() => setOpen(true)} type="button">
        <span className="text-base font-normal">＋</span> Nova oportunidade
      </button>
      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Cadastrar nova oportunidade">
          <div className="mx-auto my-8 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Novo registro</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Cadastrar oportunidade</h2>
                <p className="mt-1 text-sm text-slate-500">Este mesmo cadastro poderá ser atualizado em qualquer etapa da oportunidade.</p>
              </div>
              <button aria-label="Fechar cadastro" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-xl text-slate-500 hover:bg-slate-50" onClick={() => setOpen(false)} type="button">×</button>
            </div>
            <form className="grid gap-4" onSubmit={submit}>
              <label className="grid gap-1 text-sm font-semibold">
                Código (opcional)
                <input className="rounded-xl border border-border px-3 py-2 font-normal uppercase" maxLength={50} name="code" onKeyDown={suggestCode} placeholder="Digite PPB_ e pressione F4" />
                <span className="text-xs font-normal text-slate-500">Digite um prefixo e pressione F4 para buscar a próxima sequência.</span>
              </label>
              <OpportunityFormFields users={users} />
              {duplicateCandidates.length > 0 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
                  <p className="font-bold">Possível duplicidade — decisão humana obrigatória</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {duplicateCandidates.map((candidate) => (
                      <li key={candidate.code}><strong>{candidate.code}</strong>: {candidate.reasons.join("; ")}</li>
                    ))}
                  </ul>
                  <label className="mt-4 grid gap-1 text-sm font-semibold">
                    Justificativa para manter registros separados
                    <textarea className="min-h-20 rounded-xl border border-amber-300 bg-white px-3 py-2 font-normal" name="duplicateJustification" minLength={10} maxLength={1000} required />
                  </label>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button className="rounded-lg bg-brand px-5 py-2.5 font-bold text-white disabled:opacity-60" disabled={submitting}>
                  {submitting ? "Salvando…" : duplicateCandidates.length > 0 ? "Confirmar registros distintos" : "Salvar oportunidade"}
                </button>
                {message && <p className="text-sm text-muted" role="status">{message}</p>}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
