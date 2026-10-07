"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Resultado = { licitacoesDescartadas: number; oportunidadesEncerradas: number; falhas: string[] };

/** Botão de confirmação da limpeza: pede um segundo "sim" antes de gravar. */
export function ConfirmarLimpeza({ licitacoes, oportunidades }: { licitacoes: number; oportunidades: number }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<Resultado>();
  const [erro, setErro] = useState<string>();
  const [pending, startTransition] = useTransition();

  function aplicar() {
    setErro(undefined);
    startTransition(async () => {
      const response = await fetch("/api/admin/limpeza-duplicatas", { method: "POST" });
      const payload = await response.json().catch(() => undefined);
      if (!response.ok) { setErro(payload?.error?.message ?? "Não foi possível aplicar a limpeza."); return; }
      setResultado(payload.data);
      setConfirmando(false);
      router.refresh();
    });
  }

  return <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
    {resultado && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
      <p className="font-bold">Limpeza aplicada: {resultado.licitacoesDescartadas} licitação(ões) descartada(s) e {resultado.oportunidadesEncerradas} oportunidade(s) encerrada(s).</p>
      {resultado.falhas.length > 0 && <ul className="mt-2 list-disc pl-5 text-amber-900">{resultado.falhas.map((falha) => <li key={falha}>{falha}</li>)}</ul>}
    </div>}
    {!confirmando
      ? <button className="rounded-xl bg-brand px-5 py-2.5 font-bold text-white disabled:opacity-60" disabled={pending || (licitacoes === 0 && oportunidades === 0)} onClick={() => setConfirmando(true)} type="button">Aplicar limpeza</button>
      : <div className="grid gap-3">
        <p className="text-sm text-slate-700">Confirma descartar <strong>{licitacoes}</strong> licitação(ões) da fila e encerrar <strong>{oportunidades}</strong> oportunidade(s) como duplicadas? Os itens &quot;Decidir à mão&quot; não são alterados.</p>
        <div className="flex gap-2">
          <button className="rounded-xl bg-brand px-5 py-2.5 font-bold text-white disabled:opacity-60" disabled={pending} onClick={aplicar} type="button">{pending ? "Aplicando…" : "Sim, aplicar"}</button>
          <button className="rounded-xl border border-slate-200 px-5 py-2.5 font-bold text-slate-700" disabled={pending} onClick={() => setConfirmando(false)} type="button">Cancelar</button>
        </div>
      </div>}
    {erro && <p className="mt-3 text-sm font-semibold text-red-700">{erro}</p>}
  </section>;
}
