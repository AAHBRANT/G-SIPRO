"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type DocumentType = "EDITAL" | "TERMO_REFERENCIA" | "ESTUDO_TECNICO_PRELIMINAR" | "ANEXO_EDITAL" | "OUTRO";
type ExtractionDefinitions = Partial<Record<DocumentType, string>>;

const typeOptions: Array<{ value: DocumentType; label: string }> = [
  { value: "EDITAL", label: "Edital" },
  { value: "TERMO_REFERENCIA", label: "Termo de Referência (TR)" },
  { value: "ESTUDO_TECNICO_PRELIMINAR", label: "Estudo Técnico Preliminar (ETP)" },
  { value: "ANEXO_EDITAL", label: "Anexo, revisão ou retificação" },
  { value: "OUTRO", label: "Outro documento" },
];
const requestedFields = ["Objeto e órgão contratante", "Data e prazo de entrega", "Participação em consórcio", "Cadastro ou CRC", "Visita técnica obrigatória", "Garantias exigidas", "Capacidade técnica e operacional", "Qualificação econômico-financeira", "Documentos de habilitação", "Critérios impeditivos ou condicionantes", "Riscos e pendências", "Conclusão preliminar"];

function guessType(name: string): DocumentType {
  if (/termo.?de.?refer[eê]ncia|\btr\b/i.test(name)) return "TERMO_REFERENCIA";
  if (/estudo.?t[eé]cnico.?preliminar|\betp\b/i.test(name)) return "ESTUDO_TECNICO_PRELIMINAR";
  if (/anexo|retifica|revis[aã]o/i.test(name)) return "ANEXO_EDITAL";
  if (/edital/i.test(name)) return "EDITAL";
  return "OUTRO";
}

export function ContextDocumentUploader({ entityType, entityId, ownerId, contextLabel, extractionDefinitions, onCompleted }: { entityType: "OPPORTUNITY" | "PROPOSAL"; entityId: string; ownerId: string; contextLabel: string; extractionDefinitions: ExtractionDefinitions; onCompleted?: () => void | Promise<void> }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<DocumentType>("OUTRO");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    if (!file || !ownerId) return;
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      form.set("type", type);
      form.set("title", file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim());
      form.set("classification", "INTERNAL");
      form.set("ownerId", ownerId);
      form.set("origin", `Recebido no contexto ${contextLabel}`);
      form.set("file", file);
      const upload = await fetch("/api/documents", { method: "POST", body: form });
      const uploaded = await upload.json() as { data?: { id?: string; version?: { id?: string } }; error?: { message?: string } };
      if (!upload.ok || !uploaded.data?.id || !uploaded.data.version?.id) throw new Error(uploaded.error?.message ?? "Não foi possível importar o documento.");

      const link = await fetch(`/api/documents/${uploaded.data.id}/links`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entityType, entityId, role: "SOURCE_DOCUMENT" }) });
      if (!link.ok) throw new Error("O arquivo foi importado, mas o vínculo com este registro falhou.");

      const definitionId = extractionDefinitions[type];
      if (definitionId) {
        const extraction = await fetch("/api/ai-extractions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            idempotencyKey: crypto.randomUUID(),
            definitionId,
            documentVersionId: uploaded.data.version.id,
            requestedFields,
            instructions: `Analise somente este arquivo, vinculado a ${contextLabel}. Não use informações de outros documentos ou oportunidades. Extraia apenas os itens padrão solicitados, cite páginas/seções e não reproduza o documento integral. Dados ausentes devem ser informados como não localizados.`,
          }),
        });
        const analysis = await extraction.json() as { data?: { status?: string; errorMessage?: string }; error?: { message?: string } };
        if (!extraction.ok || analysis.data?.status !== "SUCCEEDED") throw new Error(analysis.error?.message ?? analysis.data?.errorMessage ?? "Documento vinculado; análise automática pendente.");
        setMessage("Documento vinculado e análise resumida concluída.");
      } else {
        setMessage("Documento vinculado. Não há caso de IA aprovado para este tipo.");
      }
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await onCompleted?.();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao processar o documento.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="rounded-xl border border-dashed border-blue-300 bg-blue-50/40 p-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
      <label className="grid flex-1 gap-1 text-xs font-bold text-slate-700">Adicionar documentação a {contextLabel}<input ref={inputRef} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={event => { const selected = event.target.files?.[0] ?? null; setFile(selected); if (selected) setType(guessType(selected.name)); }}/></label>
      <label className="grid gap-1 text-xs font-bold text-slate-700">Tipo documental<select className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal" value={type} onChange={event => setType(event.target.value as DocumentType)}>{typeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <button className="h-10 rounded-lg bg-brand px-4 text-xs font-bold text-white disabled:opacity-50" disabled={!file || busy} onClick={submit} type="button">{busy ? "Vinculando e analisando…" : "Adicionar e analisar"}</button>
    </div>
    {message && <p className="mt-3 text-xs font-semibold text-brand" role="status">{message}</p>}
  </section>;
}
