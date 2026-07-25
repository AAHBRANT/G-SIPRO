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
    setMessage("Cadastrando base operacional…");
    const response = await fetch("/api/operational-bases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: form.get("code"),
        name: form.get("name"),
        locality: form.get("locality"),
        latitude: Number(form.get("latitude")),
        longitude: Number(form.get("longitude")),
        source: form.get("source"),
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

  return <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <header className="flex flex-col justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2">
        <GsIcon className="h-4 w-4 text-brand" name="target"/>
        <div><h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Bases operacionais</h2><p className="mt-1 text-[10px] text-slate-500">Origens autorizadas para cálculo de distância, duração, pedágios e mobilização.</p></div>
      </div>
      {canConfigure && <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3 text-xs font-bold text-white" onClick={() => setOpen((value) => !value)} type="button"><span className="text-base leading-none">+</span> Adicionar base</button>}
    </header>

    {message && <p aria-live="polite" className="border-b border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900" role="status">{message}</p>}

    {open && <form className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={submit}>
      <label className="grid gap-1 text-xs font-bold text-slate-700">Código<input className={fieldClass} maxLength={50} minLength={2} name="code" placeholder="SEDE-BH" required/></label>
      <label className="grid gap-1 text-xs font-bold text-slate-700">Nome<input className={fieldClass} maxLength={200} minLength={2} name="name" placeholder="Sede Belo Horizonte" required/></label>
      <label className="grid gap-1 text-xs font-bold text-slate-700 lg:col-span-2">Localidade<input className={fieldClass} maxLength={200} minLength={2} name="locality" placeholder="Belo Horizonte/MG" required/></label>
      <label className="grid gap-1 text-xs font-bold text-slate-700">Latitude<input className={fieldClass} max="90" min="-90" name="latitude" placeholder="-19.9167" required step="0.0000001" type="number"/></label>
      <label className="grid gap-1 text-xs font-bold text-slate-700">Longitude<input className={fieldClass} max="180" min="-180" name="longitude" placeholder="-43.9345" required step="0.0000001" type="number"/></label>
      <label className="grid gap-1 text-xs font-bold text-slate-700 sm:col-span-2">Fonte das coordenadas<input className={fieldClass} maxLength={500} minLength={2} name="source" placeholder="Cadastro corporativo ou referência cartográfica autorizada" required/></label>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-4"><button className="rounded-lg bg-brand px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50" disabled={busy} type="submit">{busy ? "Cadastrando…" : "Salvar base operacional"}</button><button className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700" onClick={() => setOpen(false)} type="button">Cancelar</button></div>
    </form>}

    <div className="overflow-x-auto">
      <table className="w-full min-w-[780px] text-left text-xs">
        <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Código</th><th className="px-4 py-3">Base</th><th className="px-4 py-3">Localidade</th><th className="px-4 py-3">Coordenadas</th><th className="px-4 py-3">Fonte</th><th className="px-4 py-3 text-center">Versão</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {bases.map((base) => <tr className="hover:bg-blue-50/30" key={base.id}><td className="px-4 py-3 font-black text-brand">{base.code}</td><td className="px-4 py-3 font-bold text-slate-900">{base.name}</td><td className="px-4 py-3 text-slate-600">{base.locality}</td><td className="px-4 py-3 font-mono text-[10px] text-slate-600">{base.latitude.toFixed(6)}, {base.longitude.toFixed(6)}</td><td className="max-w-[320px] px-4 py-3"><p className="truncate text-slate-600" title={base.source}>{base.source}</p></td><td className="px-4 py-3 text-center text-slate-500">v{base.version}</td></tr>)}
          {bases.length === 0 && <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={6}>Nenhuma base operacional ativa. Cadastre uma base antes de calcular rotas.</td></tr>}
        </tbody>
      </table>
    </div>
  </section>;
}
