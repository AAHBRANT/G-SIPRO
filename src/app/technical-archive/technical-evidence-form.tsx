"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Option = Readonly<{ id: string; label: string }>;

export function TechnicalEvidenceForm({ experiences, documentVersions, previousVersions, cats }: { experiences: readonly Option[]; documentVersions: readonly Option[]; previousVersions: readonly Option[]; cats: readonly Option[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const optional = (name: string) => form.get(name) || undefined;
    const payload = {
      experienceId: form.get("experienceId"), type: form.get("type"), number: form.get("number"), issuingBody: form.get("issuingBody"), issuedAt: form.get("issuedAt"), validUntil: optional("validUntil"), status: form.get("status"), subjectActivity: form.get("subjectActivity"), professionalName: optional("professionalName"), professionalIdentifier: optional("professionalIdentifier"), startedAt: optional("startedAt"), endedAt: optional("endedAt"), restrictions: optional("restrictions"), documentVersionId: form.get("documentVersionId"), previousVersionId: optional("previousVersionId"), relatedCatId: optional("relatedCatId"),
    };
    const response = await fetch("/api/technical-archive/evidence", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json() as { error?: { message?: string } };
    setMessage(response.ok ? "Versão do documento técnico cadastrada." : result.error?.message ?? "Falha no cadastro.");
    if (response.ok) router.refresh();
  }

  return <form className="grid gap-4 rounded-2xl border border-border bg-surface p-6" onSubmit={submit}>
    <h2 className="text-xl font-bold">Cadastrar atestado, CAT ou ART</h2>
    <div className="grid gap-3 md:grid-cols-3">
      <select className="rounded-xl border border-border px-3 py-2" name="experienceId" required>{experiences.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      <select className="rounded-xl border border-border px-3 py-2" name="type"><option value="ATTESTATION">Atestado</option><option value="CAT">CAT</option><option value="ART">ART</option></select>
      <input className="rounded-xl border border-border px-3 py-2" name="number" required placeholder="Número do documento" />
      <input className="rounded-xl border border-border px-3 py-2" name="issuingBody" required placeholder="Emissor ou conselho" />
      <input className="rounded-xl border border-border px-3 py-2" name="issuedAt" type="date" required />
      <input className="rounded-xl border border-border px-3 py-2" name="validUntil" type="date" aria-label="Validade" />
      <select className="rounded-xl border border-border px-3 py-2" name="status"><option value="CURRENT">Vigente</option><option value="RESTRICTED">Restrito</option><option value="EXPIRED">Vencido</option></select>
      <input className="rounded-xl border border-border px-3 py-2" name="professionalName" placeholder="Profissional (obrigatório em CAT/ART)" />
      <input className="rounded-xl border border-border px-3 py-2" name="professionalIdentifier" placeholder="Registro profissional" />
      <input className="rounded-xl border border-border px-3 py-2" name="startedAt" type="date" aria-label="Início da atividade" />
      <input className="rounded-xl border border-border px-3 py-2" name="endedAt" type="date" aria-label="Fim da atividade" />
      <select className="rounded-xl border border-border px-3 py-2" name="documentVersionId" required>{documentVersions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
    </div>
    <textarea className="rounded-xl border border-border px-3 py-2" name="subjectActivity" required placeholder="Objeto do atestado ou atividade técnica original" />
    <textarea className="rounded-xl border border-border px-3 py-2" name="restrictions" placeholder="Restrições registradas na fonte" />
    <div className="grid gap-3 md:grid-cols-2">
      <select className="rounded-xl border border-border px-3 py-2" name="previousVersionId"><option value="">Primeira versão</option>{previousVersions.map(item => <option key={item.id} value={item.id}>{`Nova versão de ${item.label}`}</option>)}</select>
      <select className="rounded-xl border border-border px-3 py-2" name="relatedCatId"><option value="">ART sem CAT relacionada</option>{cats.map(item => <option key={item.id} value={item.id}>{`Relacionar à ${item.label}`}</option>)}</select>
    </div>
    <div><button className="rounded-xl bg-brand px-5 py-2.5 font-bold text-white">Cadastrar documento técnico</button>{message && <span className="ml-3 text-sm text-muted">{message}</span>}</div>
  </form>;
}
