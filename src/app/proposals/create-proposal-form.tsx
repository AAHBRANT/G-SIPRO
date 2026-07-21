"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { browserRandomUuid } from "./browser-random-uuid";
import { snapshotSelectedFiles } from "./selected-files";

export type OpportunityOption = Readonly<{
  id: string;
  label: string;
  tenders: ReadonlyArray<{
    id: string;
    label: string;
    versions: ReadonlyArray<{ id: string; label: string }>;
    lots: ReadonlyArray<{ id: string; label: string }>;
  }>;
}>;

export type ProposalDocumentType =
  | "EDITAL"
  | "TERMO_REFERENCIA"
  | "ESTUDO_TECNICO_PRELIMINAR"
  | "ANEXO_EDITAL"
  | "OUTRO";

export type ProposalExtractionDefinitions = Partial<Record<ProposalDocumentType, string>>;

type OriginType = "PUBLIC_TENDER" | "PRIVATE_COMPETITION" | "DIRECT";
type DocumentStatus = "PENDING" | "UPLOADING" | "ANALYZING" | "DONE" | "UPLOADED" | "FAILED";
type AnalysisField = { field: string; value: string };
type AnalysisEvidence = { excerpt: string; locator: string };
type ArchiveMatch = { serviceId: string; discipline: string; description: string; quantities: Array<{ value: string; unit: string; source: string }>; contract: { code: string; subject: string; contractorName: string }; evidence: { title: string; versionId: string; version: number }; matchedKeywords: string[] };
type PendingDocument = {
  id: string;
  file: File;
  type: ProposalDocumentType;
  title: string;
  status: DocumentStatus;
  fields: AnalysisField[];
  evidence: AnalysisEvidence[];
  confidence?: string | null;
  message?: string;
};

const documentTypes: Array<{ value: ProposalDocumentType; label: string }> = [
  { value: "EDITAL", label: "Edital" },
  { value: "TERMO_REFERENCIA", label: "Termo de Referência (TR)" },
  { value: "ESTUDO_TECNICO_PRELIMINAR", label: "Estudo Técnico Preliminar (ETP)" },
  { value: "ANEXO_EDITAL", label: "Anexo do edital" },
  { value: "OUTRO", label: "Outro documento" },
];

const requestedFields = [
  "Data e prazo de entrega",
  "Participação em consórcio",
  "Cadastro ou CRC",
  "Visita técnica obrigatória",
  "Carta-fiança ou garantia",
  "Capacidade técnica exigida",
  "Proposta técnica exigida",
  "Forma e arquivo digital para apresentação",
  "Validade das certidões",
  "Data de emissão dos documentos",
  "Identificação e nome da empresa",
  "Regularidade fiscal e certidões negativas",
  "Critérios impeditivos ou condicionantes de participação",
  "Conclusão preliminar sobre participação",
];

const statusText: Record<DocumentStatus, string> = {
  PENDING: "Aguardando",
  UPLOADING: "Enviando arquivo",
  ANALYZING: "Analisando pré-requisitos",
  DONE: "Análise concluída",
  UPLOADED: "Importado — análise indisponível",
  FAILED: "Falha",
};

function guessType(name: string): ProposalDocumentType {
  if (/termo.?de.?refer[eê]ncia|\btr\b/i.test(name)) return "TERMO_REFERENCIA";
  if (/estudo.?t[eé]cnico.?preliminar|\betp\b/i.test(name)) return "ESTUDO_TECNICO_PRELIMINAR";
  if (/anexo/i.test(name)) return "ANEXO_EDITAL";
  if (/edital/i.test(name)) return "EDITAL";
  return "OUTRO";
}

function cleanTitle(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

function extractionFields(value: unknown): AnalysisField[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const field = "field" in entry ? entry.field : undefined;
    const content = "value" in entry ? entry.value : undefined;
    return typeof field === "string" && typeof content === "string" ? [{ field, value: content }] : [];
  });
}

export function CreateProposalForm({
  opportunities,
  users,
  extractionDefinitions,
  onClose,
}: {
  opportunities: ReadonlyArray<OpportunityOption>;
  users: ReadonlyArray<{ id: string; label: string }>;
  extractionDefinitions: ProposalExtractionDefinitions;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [opportunityId, setOpportunityId] = useState(opportunities[0]?.id ?? "");
  const opportunity = useMemo(
    () => opportunities.find((item) => item.id === opportunityId),
    [opportunities, opportunityId],
  );
  const [tenderId, setTenderId] = useState(opportunity?.tenders[0]?.id ?? "");
  const tender = opportunity?.tenders.find((item) => item.id === tenderId) ?? opportunity?.tenders[0];
  const [originType, setOriginType] = useState<OriginType>(opportunity?.tenders.length ? "PUBLIC_TENDER" : "DIRECT");
  const [proposalId, setProposalId] = useState("");
  const [proposalCode, setProposalCode] = useState("");
  const [ownerId, setOwnerId] = useState(users[0]?.id ?? "");
  const [documents, setDocuments] = useState<PendingDocument[]>([]);
  const [archiveMatches, setArchiveMatches] = useState<ArchiveMatch[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function updateDocument(id: string, changes: Partial<PendingDocument>) {
    setDocuments((current) => current.map((document) => (document.id === id ? { ...document, ...changes } : document)));
  }

  async function createProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/proposals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: `PROP-${Date.now().toString(36).toUpperCase()}`,
          title: form.get("title"),
          opportunityId,
          originType,
          ...(originType === "PUBLIC_TENDER" && tender?.versions.length && tender?.lots.length
            ? { tenderVersionId: form.get("tenderVersionId"), tenderLotId: form.get("tenderLotId") }
            : {}),
        }),
      });
      const result = (await response.json()) as { data?: { id?: string; code?: string }; error?: { message?: string } };
      if (!response.ok || !result.data?.id) throw new Error(result.error?.message ?? "Falha ao criar proposta.");
      setProposalId(result.data.id);
      setProposalCode(result.data.code ?? "Nova proposta");
      setStep(2);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao criar proposta.");
    } finally {
      setBusy(false);
    }
  }

  function addFiles(files: FileList | null) {
    const selectedFiles = snapshotSelectedFiles(files);
    if (!selectedFiles.length) return;
    setDocuments((current) => [
      ...current,
      ...selectedFiles.map((file) => ({
        id: browserRandomUuid(),
        file,
        type: guessType(file.name),
        title: cleanTitle(file.name),
        status: "PENDING" as const,
        fields: [],
        evidence: [],
      })),
    ]);
  }

  async function processDocument(document: PendingDocument) {
    try {
      updateDocument(document.id, { status: "UPLOADING", message: undefined });
      const form = new FormData();
      form.set("type", document.type);
      form.set("title", document.title);
      form.set("classification", "INTERNAL");
      form.set("ownerId", ownerId);
      form.set("origin", `Recebido para análise da proposta ${proposalCode}`);
      form.set("file", document.file);
      const response = await fetch("/api/documents", { method: "POST", body: form });
      const result = (await response.json()) as {
        data?: { id?: string; version?: { id?: string } };
        error?: { message?: string };
      };
      if (!response.ok || !result.data?.id || !result.data.version?.id) {
        throw new Error(result.error?.message ?? "Falha ao importar o documento.");
      }

      const link = await fetch(`/api/documents/${result.data.id}/links`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entityType: "PROPOSAL", entityId: proposalId, role: "SOURCE_DOCUMENT" }),
      });
      if (!link.ok) throw new Error("Documento importado, mas o vínculo com a proposta ficou pendente.");

      const definitionId = extractionDefinitions[document.type];
      if (!definitionId) {
        updateDocument(document.id, {
          status: "UPLOADED",
          message: "Não existe caso de uso de IA aprovado para este tipo documental.",
        });
        return;
      }

      updateDocument(document.id, { status: "ANALYZING" });
      const extraction = await fetch("/api/ai-extractions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: browserRandomUuid(),
          definitionId,
          documentVersionId: result.data.version.id,
          requestedFields,
          instructions:
            "Extraia apenas informações expressas no documento. Para cada pré-requisito, informe a exigência, prazo ou condição e preserve a referência de página/seção nas evidências. A conclusão de participação é preliminar, assistiva e depende de validação humana. Não invente dados ausentes.",
        }),
      });
      const analysis = (await extraction.json()) as {
        data?: {
          status?: string;
          output?: unknown;
          confidence?: string | null;
          errorMessage?: string | null;
          evidence?: AnalysisEvidence[];
        };
        error?: { message?: string };
      };
      if (!extraction.ok) throw new Error(analysis.error?.message ?? "Falha ao analisar o documento.");
      if (analysis.data?.status !== "SUCCEEDED") {
        throw new Error(analysis.data?.errorMessage ?? "A análise foi registrada, mas não foi concluída.");
      }
      updateDocument(document.id, {
        status: "DONE",
        fields: extractionFields(analysis.data.output),
        evidence: Array.isArray(analysis.data.evidence) ? analysis.data.evidence : [],
        confidence: analysis.data.confidence,
      });
    } catch (error) {
      updateDocument(document.id, {
        status: "FAILED",
        message: error instanceof Error ? error.message : "Falha no processamento.",
      });
    }
  }

  async function uploadAndAnalyze() {
    if (!documents.length || !ownerId) return;
    setBusy(true);
    setMessage("");
    await Promise.all(documents.map(processDocument));
    try {
      const response = await fetch(`/api/proposals/${proposalId}/analysis`);
      const payload = (await response.json()) as { data?: { archiveMatches?: ArchiveMatch[] } };
      if (response.ok) setArchiveMatches(payload.data?.archiveMatches ?? []);
    } catch {
      setArchiveMatches([]);
    }
    setBusy(false);
    setStep(3);
    router.refresh();
  }

  if (!opportunities.length) {
    return <p className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">Cadastre uma oportunidade antes de criar a proposta.</p>;
  }

  const completed = documents.filter((document) => document.status === "DONE").length;
  const uploadedOnly = documents.filter((document) => document.status === "UPLOADED").length;
  const failed = documents.filter((document) => document.status === "FAILED").length;

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold">
        {["1. Cadastro", "2. Documentos", "3. Pré-requisitos"].map((label, index) => (
          <div className={`px-4 py-3 text-center ${step === index + 1 ? "bg-brand text-white" : index + 1 < step ? "bg-blue-50 text-brand" : "text-slate-400"}`} key={label}>{label}</div>
        ))}
      </div>

      {step === 1 && (
        <form className="grid gap-4" onSubmit={createProposal}>
          <div><p className="text-sm font-bold uppercase tracking-wider text-brand">Novo cadastro</p><h2 className="mt-1 text-xl font-bold">Criar proposta</h2><p className="mt-1 text-xs text-muted">Informe somente os dados essenciais. Os documentos entram na próxima etapa.</p></div>
          <div className="grid min-w-0 gap-4 md:grid-cols-3">
            <label className="grid min-w-0 gap-1 text-sm font-bold">Tipo da proposta<select className="w-full min-w-0 rounded-xl border border-border px-3 py-2 font-normal" onChange={(event) => setOriginType(event.target.value as OriginType)} value={originType}><option value="PUBLIC_TENDER">Edital / concorrência pública</option><option value="PRIVATE_COMPETITION">Concorrência privada</option><option value="DIRECT">Proposta direta</option></select></label>
            <label className="grid min-w-0 gap-1 text-sm font-bold">Título da proposta<input className="w-full min-w-0 rounded-xl border border-border px-3 py-2 font-normal" maxLength={255} name="title" placeholder="Ex.: Obra de saneamento — São Paulo" required /></label>
            <label className="grid min-w-0 gap-1 text-sm font-bold">Oportunidade<select className="w-full min-w-0 rounded-xl border border-border px-3 py-2 font-normal" onChange={(event) => { const id = event.target.value; setOpportunityId(id); const next = opportunities.find((item) => item.id === id); setTenderId(next?.tenders[0]?.id ?? ""); }} value={opportunityId}>{opportunities.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          </div>
          {originType === "PUBLIC_TENDER" && opportunity?.tenders.length && tender?.versions.length && tender?.lots.length ? <div className="grid min-w-0 gap-4 rounded-xl bg-background p-4 md:grid-cols-3"><label className="grid min-w-0 gap-1 text-sm font-bold">Edital<select className="w-full min-w-0 rounded-xl border border-border px-3 py-2 font-normal" onChange={(event) => setTenderId(event.target.value)} value={tender?.id}>{opportunity.tenders.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="grid min-w-0 gap-1 text-sm font-bold">Versão documental<select className="w-full min-w-0 rounded-xl border border-border px-3 py-2 font-normal" name="tenderVersionId" required>{tender?.versions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="grid min-w-0 gap-1 text-sm font-bold">Lote<select className="w-full min-w-0 rounded-xl border border-border px-3 py-2 font-normal" name="tenderLotId" required>{tender?.lots.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label></div> : originType === "PUBLIC_TENDER" ? <p className="rounded-xl bg-blue-50 p-3 text-xs font-bold text-blue-800">O edital ainda não está cadastrado nesta oportunidade. Você poderá criar a proposta agora e enviar o Edital, TR, ETP e anexos na próxima etapa.</p> : <p className="text-xs text-muted">Esta proposta será vinculada diretamente à oportunidade, sem exigir edital previamente cadastrado.</p>}
          <div className="flex justify-end"><button className="rounded-xl bg-brand px-5 py-2.5 font-bold text-white disabled:opacity-50" disabled={busy}>{busy ? "Criando…" : "Criar e adicionar documentos →"}</button></div>
          {message && <p className="text-sm font-semibold text-rose-700" role="status">{message}</p>}
        </form>
      )}

      {step === 2 && (
        <section className="grid gap-4">
          <div><p className="text-sm font-bold uppercase tracking-wider text-brand">{proposalCode}</p><h2 className="mt-1 text-xl font-bold">Adicionar documentos para análise</h2><p className="mt-1 text-xs text-muted">Selecione vários arquivos. O sistema sugere o tipo pelo nome e você pode corrigi-lo antes de processar.</p></div>
          <div className="grid gap-3 rounded-xl border border-dashed border-blue-300 bg-blue-50/40 p-5 md:grid-cols-[1fr_260px]">
            <label className="grid cursor-pointer place-items-center rounded-xl bg-white p-6 text-center shadow-sm"><span className="text-sm font-bold text-brand">＋ Selecionar Edital, TR, ETP e anexos</span><span className="mt-1 text-xs text-slate-500">PDF, Word, Excel, TXT ou CSV</span><input accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" className="sr-only" multiple onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} type="file" /></label>
            <label className="grid content-center gap-1 text-sm font-bold">Responsável pelos documentos<select className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal" onChange={(event) => setOwnerId(event.target.value)} value={ownerId}>{users.map((user) => <option key={user.id} value={user.id}>{user.label}</option>)}</select></label>
          </div>
          <div className="grid gap-2">{documents.map((document) => <article className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_220px_auto] md:items-center" key={document.id}><div className="min-w-0"><input className="w-full rounded-lg border border-transparent px-2 py-1 text-sm font-bold outline-none hover:border-slate-200 focus:border-blue-400" disabled={busy} onChange={(event) => updateDocument(document.id, { title: event.target.value })} value={document.title} /><p className="truncate px-2 text-xs text-slate-500">{document.file.name} · {(document.file.size / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB</p></div><select className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold" disabled={busy} onChange={(event) => updateDocument(document.id, { type: event.target.value as ProposalDocumentType })} value={document.type}>{documentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select><button className="rounded-lg px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-40" disabled={busy} onClick={() => setDocuments((current) => current.filter((item) => item.id !== document.id))} type="button">Remover</button></article>)}{documents.length === 0 && <p className="rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-500">Nenhum documento selecionado.</p>}</div>
          <div className="flex justify-end"><button className="rounded-xl bg-brand px-5 py-2.5 font-bold text-white disabled:opacity-50" disabled={busy || !documents.length || !ownerId} onClick={uploadAndAnalyze} type="button">{busy ? "Processando documentos…" : `Importar e analisar ${documents.length || ""} documento${documents.length === 1 ? "" : "s"}`}</button></div>
        </section>
      )}

      {step === 3 && (
        <section className="grid gap-4">
          <div><p className="text-sm font-bold uppercase tracking-wider text-brand">{proposalCode}</p><h2 className="mt-1 text-xl font-bold">Pré-requisitos identificados</h2><p className="mt-1 text-xs text-muted">Resultado assistivo com fonte preservada. A validação final permanece com a equipe responsável.</p></div>
          <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-700">Análises concluídas</p><p className="mt-1 text-2xl font-black text-emerald-700">{completed}</p></div><div className="rounded-xl bg-amber-50 p-4"><p className="text-xs font-bold text-amber-700">Somente importados</p><p className="mt-1 text-2xl font-black text-amber-700">{uploadedOnly}</p></div><div className="rounded-xl bg-rose-50 p-4"><p className="text-xs font-bold text-rose-700">Com falha</p><p className="mt-1 text-2xl font-black text-rose-700">{failed}</p></div></div>
          <div className="grid gap-4">{documents.map((document) => <article className="overflow-hidden rounded-xl border border-slate-200" key={document.id}><header className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-3"><div><p className="text-xs font-bold text-brand">{documentTypes.find((type) => type.value === document.type)?.label}</p><h3 className="font-bold text-slate-900">{document.title}</h3></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${document.status === "DONE" ? "bg-emerald-100 text-emerald-700" : document.status === "FAILED" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{statusText[document.status]}</span></header>{document.message && <p className="m-4 rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-800">{document.message}</p>}{document.fields.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-y border-slate-200 bg-white text-xs uppercase text-slate-500"><tr><th className="p-3">Pré-requisito</th><th className="p-3">Resultado encontrado</th><th className="p-3">Situação</th></tr></thead><tbody className="divide-y divide-slate-100">{document.fields.map((field, index) => <tr key={`${field.field}-${index}`}><td className="p-3 font-semibold">{field.field}</td><td className="whitespace-pre-wrap p-3 text-slate-700">{field.value}</td><td className="p-3"><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">Revisar</span></td></tr>)}</tbody></table></div>}{document.evidence.length > 0 && <details className="border-t border-slate-200 p-4"><summary className="cursor-pointer text-xs font-bold text-brand">Ver evidências e páginas ({document.evidence.length})</summary><div className="mt-3 grid gap-2">{document.evidence.map((evidence, index) => <blockquote className="border-l-4 border-blue-200 pl-3 text-xs text-slate-600" key={`${evidence.locator}-${index}`}>{evidence.excerpt} <strong>— {evidence.locator}</strong></blockquote>)}</div></details>}</article>)}</div>
          <section className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Cruzamento com o acervo</p><h3 className="mt-1 font-black">Serviços técnicos correspondentes</h3></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{archiveMatches.length} resultado(s)</span></div><p className="mt-1 text-xs text-slate-500">Correspondência textual preliminar; não constitui aprovação de capacidade técnica.</p><div className="mt-3 grid gap-2">{archiveMatches.slice(0, 5).map((match) => <article className="rounded-lg border border-emerald-100 bg-white p-3" key={match.serviceId}><div className="flex flex-wrap justify-between gap-2"><div><p className="text-xs font-bold text-emerald-700">{match.discipline} · {match.contract.code}</p><p className="mt-1 text-sm font-bold">{match.description}</p></div><a className="text-xs font-bold text-brand" href={`/api/documents/versions/${match.evidence.versionId}/content`} target="_blank" rel="noreferrer">Abrir atestado</a></div>{match.quantities.length > 0 && <p className="mt-2 text-xs text-slate-600"><strong>Quantidades:</strong> {match.quantities.map((quantity) => `${quantity.value} ${quantity.unit}`).join(" · ")}</p>}</article>)}{archiveMatches.length === 0 && <p className="rounded-lg bg-white p-4 text-center text-xs text-slate-500">Nenhuma correspondência automática encontrada ou a pesquisa no acervo não está disponível para este usuário.</p>}</div></section>
          <div className="flex justify-end"><button className="rounded-xl bg-brand px-5 py-2.5 font-bold text-white" onClick={() => { router.refresh(); onClose?.(); }} type="button">Concluir</button></div>
        </section>
      )}
    </div>
  );
}
