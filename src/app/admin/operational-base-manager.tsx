"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { GsIcon } from "@/components/ui/gs-icon";

export type OperationalBaseView = Readonly<{
  id: string;
  code: string;
  name: string;
  locality: string;
  latitude: number;
  longitude: number;
  source: string;
  version: number;
}>;

const fieldClass = "rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal text-slate-800";

export function OperationalBaseManager({ bases, canConfigure }: { bases: readonly OperationalBaseView[]; canConfigure: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    setBusy(true);
    setMessage("Localizando e cadastrando a base operacional…");
    const response = await fetch("/api/operational-bases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: form.get("code"),
        name: form.get("name"),
        address: form.get("address"),
      }),
    });
    const result = await response.json().catch(() => ({})) as { error?: { message?: string } };
    setBusy(false);
    setMessage(response.ok ? "Base operacional cadastrada e disponível para os estudos logísticos." : result.error?.message ?? "Não foi possível cadastrar a base.");
    if (response.ok) {
      element.reset();
      setOpen(false);
      router.refresh();
    }
  }

  return <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" id="bases-operacionais">
    <header className="flex flex-col justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2">
        <GsIcon className="h-4 w-4 text-brand" name="target"/>
        <div><h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Bases operacionais</h2><p className="mt-1 text-[10px] text-slate-500">Cadastre matriz e filiais uma única vez. Todas as bases ativas serão comparadas no cálculo de distância e rota.</p></div>
      </div>
      {canConfigure && <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3 text-xs font-bold text-white" onClick={() => setOpen((value) => !value)} type="button"><span className="text-base leading-none">+</span> Adicionar base</button>}
    </header>

    {message && <p aria-live="polite" className="border-b border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900" role="status">{message}</p>}

    {open && <form className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={submit}>
      <label className="grid gap-1 text-xs font-bold text-slate-700">Código<input className={fieldClass} maxLength={50} minLength={2} name="code" placeholder="MATRIZ ou FILIAL-01" required/></label>
      <label className="grid gap-1 text-xs font-bold text-slate-700">Nome da base<input className={fieldClass} maxLength={200} minLength={2} name="name" placeholder="Matriz ou Filial João Pessoa" required/></label>
      <label className="grid gap-1 text-xs font-bold text-slate-700 sm:col-span-2">Cidade ou endereço da base<input className={fieldClass} maxLength={500} minLength={2} name="address" placeholder="João Pessoa/PB ou endereço completo" required/><span className="font-normal text-slate-500">O Azure Maps localizará as coordenadas automaticamente.</span></label>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-4"><button className="rounded-lg bg-brand px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50" disabled={busy} type="submit">{busy ? "Localizando e salvando…" : "Salvar base operacional"}</button><button className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700" onClick={() => setOpen(false)} type="button">Cancelar</button></div>
    </form>}

    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-xs">
        <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Código</th><th className="px-4 py-3">Base</th><th className="px-4 py-3">Localidade confirmada</th><th className="px-4 py-3">Localização</th><th className="px-4 py-3 text-center">Versão</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {bases.map((base) => <tr className="hover:bg-blue-50/30" key={base.id}><td className="px-4 py-3 font-black text-brand">{base.code}</td><td className="px-4 py-3 font-bold text-slate-900">{base.name}</td><td className="px-4 py-3 text-slate-600">{base.locality}</td><td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700" title={`${base.source} · ${base.latitude.toFixed(6)}, ${base.longitude.toFixed(6)}`}>Confirmada pelo Azure Maps</span></td><td className="px-4 py-3 text-center text-slate-500">v{base.version}</td></tr>)}
          {bases.length === 0 && <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={5}>Nenhuma base operacional ativa. Cadastre matriz e filiais antes de calcular rotas.</td></tr>}
        </tbody>
      </table>
    </div>
  </section>;
}
