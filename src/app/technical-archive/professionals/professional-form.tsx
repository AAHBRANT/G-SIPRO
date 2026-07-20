"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type TargetOption = Readonly<{ id: string; label: string; targetType: "CONTRACT" | "WORK" | "TECHNICAL_EVIDENCE"; documentVersionId?: string }>;
type DocumentOption = Readonly<{ id: string; label: string }>;

export function ProfessionalForm({ targets, documents }: { targets: readonly TargetOption[]; documents: readonly DocumentOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const [targetType, targetId, forcedDocumentVersionId] = String(form.get("target")).split(":");
    const payload = { fullName: form.get("fullName"), council: form.get("council"), registrationNumber: form.get("registrationNumber"), nationalRegistration: form.get("nationalRegistration") || undefined, professionalTitle: form.get("professionalTitle"), status: form.get("status"), processingPurpose: form.get("processingPurpose"), legalBasis: form.get("legalBasis"), links: [{ targetType, targetId, role: form.get("role"), responsibility: form.get("responsibility"), startedAt: form.get("startedAt"), endedAt: form.get("endedAt"), source: form.get("source"), evidenceDocumentVersionId: forcedDocumentVersionId || form.get("evidenceDocumentVersionId") }] };
    const response = await fetch("/api/technical-archive/professionals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json() as { error?: { message?: string } };
    setMessage(response.ok ? "Profissional e vínculo cadastrados com proteção por finalidade." : result.error?.message ?? "Falha no cadastro.");
    if (response.ok) router.refresh();
  }
  return <form className="grid gap-4 rounded-2xl border border-border bg-surface p-6" onSubmit={submit}>
    <div><h2 className="text-xl font-bold">Cadastrar profissional protegido</h2><p className="mt-1 text-sm text-muted">Não informe CPF, endereço, telefone ou e-mail. O modelo aceita somente os dados profissionais necessários.</p></div>
    <div className="grid gap-3 md:grid-cols-3">
      <input className="rounded-xl border border-border px-3 py-2" name="fullName" required placeholder="Nome profissional" />
      <input className="rounded-xl border border-border px-3 py-2" name="council" required placeholder="Conselho, ex.: CREA-SP" />
      <input className="rounded-xl border border-border px-3 py-2" name="registrationNumber" required placeholder="Registro profissional" />
      <input className="rounded-xl border border-border px-3 py-2" name="nationalRegistration" placeholder="RNP, se constar na fonte" />
      <input className="rounded-xl border border-border px-3 py-2" name="professionalTitle" required placeholder="Título profissional" />
      <select className="rounded-xl border border-border px-3 py-2" name="status"><option value="ACTIVE">Ativo</option><option value="RESTRICTED">Restrito</option><option value="INACTIVE">Inativo</option></select>
    </div>
    <textarea className="rounded-xl border border-border px-3 py-2" name="processingPurpose" required placeholder="Finalidade específica do tratamento" />
    <input className="rounded-xl border border-border px-3 py-2" name="legalBasis" required placeholder="Base legal validada para o tratamento" />
    <h3 className="font-bold">Vínculo técnico comprovado</h3>
    <select className="rounded-xl border border-border px-3 py-2" name="target" required>{targets.map(target => <option key={`${target.targetType}:${target.id}`} value={`${target.targetType}:${target.id}:${target.documentVersionId ?? ""}`}>{target.label}</option>)}</select>
    <div className="grid gap-3 md:grid-cols-3">
      <input className="rounded-xl border border-border px-3 py-2" name="role" required placeholder="Função no vínculo" />
      <input className="rounded-xl border border-border px-3 py-2" name="startedAt" type="date" required />
      <input className="rounded-xl border border-border px-3 py-2" name="endedAt" type="date" required />
    </div>
    <textarea className="rounded-xl border border-border px-3 py-2" name="responsibility" required placeholder="Responsabilidade técnica conforme a fonte" />
    <div className="grid gap-3 md:grid-cols-2"><input className="rounded-xl border border-border px-3 py-2" name="source" required placeholder="Descrição da fonte" /><select className="rounded-xl border border-border px-3 py-2" name="evidenceDocumentVersionId" required>{documents.map(document => <option key={document.id} value={document.id}>{document.label}</option>)}</select></div>
    <div><button className="rounded-xl bg-brand px-5 py-2.5 font-bold text-white">Cadastrar profissional</button>{message && <span className="ml-3 text-sm text-muted">{message}</span>}</div>
  </form>;
}
