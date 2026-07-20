"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function TenderForm({ opportunities }: { opportunities: readonly { id: string; code: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sourceForm = new FormData(event.currentTarget);
    const file = sourceForm.get("file");
    if (!(file instanceof File) || file.size === 0) return setMessage("Selecione o documento principal.");
    setBusy(true); setMessage("Enviando e preservando o arquivo original…");
    const lotCode = sourceForm.get("lotCode")?.toString().trim();
    const lotSubject = sourceForm.get("lotSubject")?.toString().trim();
    const tender = {
      code: sourceForm.get("code"), number: sourceForm.get("number"), modality: sourceForm.get("modality"),
      subject: sourceForm.get("subject"), origin: sourceForm.get("origin"),
      opportunityId: sourceForm.get("opportunityId") || undefined,
      lots: lotCode && lotSubject ? [{ code: lotCode, subject: lotSubject }] : [],
    };
    const upload = new FormData();
    upload.set("tender", JSON.stringify(tender));
    upload.set("source", sourceForm.get("origin")?.toString() ?? "");
    upload.set("file", file);
    const response = await fetch("/api/tenders", { method: "POST", body: upload });
    const result = (await response.json()) as { data?: { id: string }; error?: { message?: string } };
    setBusy(false); setMessage(response.ok ? "Edital e arquivo original preservados." : result.error?.message ?? "Falha no cadastro.");
    if (response.ok && result.data) router.push(`/tenders/${result.data.id}`);
  }

  return <form className="grid gap-4 rounded-2xl border border-border bg-surface p-6 shadow-sm" onSubmit={submit}>
    <div><p className="text-sm font-bold uppercase tracking-wider text-brand">BL-103</p><h2 className="mt-1 text-xl font-bold">Importar edital</h2></div>
    <div className="grid gap-4 md:grid-cols-3">
      <label className="grid gap-1 text-sm font-semibold">Código<input className="rounded-xl border border-border px-3 py-2 font-normal" name="code" required maxLength={50}/></label>
      <label className="grid gap-1 text-sm font-semibold">Número<input className="rounded-xl border border-border px-3 py-2 font-normal" name="number" required maxLength={100}/></label>
      <label className="grid gap-1 text-sm font-semibold">Modalidade<input className="rounded-xl border border-border px-3 py-2 font-normal" name="modality" required maxLength={100}/></label>
    </div>
    <label className="grid gap-1 text-sm font-semibold">Objeto<textarea className="min-h-24 rounded-xl border border-border px-3 py-2 font-normal" name="subject" required/></label>
    <label className="grid gap-1 text-sm font-semibold">Origem oficial<input className="rounded-xl border border-border px-3 py-2 font-normal" name="origin" required maxLength={500} placeholder="Portal ou referência verificável"/></label>
    <label className="grid gap-1 text-sm font-semibold">Oportunidade vinculada<select className="rounded-xl border border-border px-3 py-2 font-normal" name="opportunityId"><option value="">Não vinculada</option>{opportunities.map((item)=><option key={item.id} value={item.id}>{item.code}</option>)}</select></label>
    <div className="grid gap-4 md:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Código do lote (opcional)<input className="rounded-xl border border-border px-3 py-2 font-normal" name="lotCode"/></label><label className="grid gap-1 text-sm font-semibold">Objeto do lote<input className="rounded-xl border border-border px-3 py-2 font-normal" name="lotSubject"/></label></div>
    <label className="grid gap-1 text-sm font-semibold">Arquivo original do edital<input accept=".pdf,.doc,.docx,.xls,.xlsx,.odt,.ods" className="rounded-xl border border-border px-3 py-2 font-normal" name="file" type="file" required/><span className="font-normal text-muted">O servidor preserva o arquivo e calcula o SHA-256; os campos complementam o documento, sem substituí-lo.</span></label>
    <div className="flex items-center gap-3"><button className="rounded-xl bg-brand px-5 py-2.5 font-bold text-white disabled:opacity-60" disabled={busy}>{busy?"Enviando…":"Importar edital"}</button>{message&&<p className="text-sm text-muted" role="status">{message}</p>}</div>
  </form>;
}
