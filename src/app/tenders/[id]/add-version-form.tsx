"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function AddVersionForm({ tenderId }: { tenderId: string }) {
  const router=useRouter(); const[message,setMessage]=useState(""); const[busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); const form=new FormData(event.currentTarget); const file=form.get("file");
    if(!(file instanceof File)||!file.size)return setMessage("Selecione o arquivo da nova versão.");
    setBusy(true); setMessage("Enviando e preservando o arquivo original…");
    const response=await fetch(`/api/tenders/${tenderId}/versions`,{method:"POST",body:form});
    const result=(await response.json())as{error?:{message?:string}};
    setBusy(false); setMessage(response.ok?"Nova versão e arquivo original preservados.":result.error?.message??"Falha ao versionar.");
    if(response.ok)router.refresh();
  }
  return <form className="grid gap-3 rounded-2xl border border-border bg-surface p-6" onSubmit={submit}><h2 className="text-xl font-bold">Importar nova versão</h2><label className="grid gap-1 text-sm font-semibold">Origem oficial<input className="rounded-xl border border-border px-3 py-2 font-normal" name="source" required/></label><label className="grid gap-1 text-sm font-semibold">Arquivo original<input accept=".pdf,.doc,.docx,.xls,.xlsx,.odt,.ods" className="rounded-xl border border-border px-3 py-2 font-normal" name="file" type="file" required/></label><button className="w-fit rounded-xl bg-brand px-5 py-2 font-bold text-white" disabled={busy}>{busy?"Enviando…":"Importar versão"}</button>{message&&<p className="text-sm text-muted" role="status">{message}</p>}</form>;
}
