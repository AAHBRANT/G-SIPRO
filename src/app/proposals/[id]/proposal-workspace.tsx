"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ContextDocumentUploader } from "@/components/documents/context-document-uploader";
import type { ProposalExtractionDefinitions } from "@/app/proposals/create-proposal-form";
import { ProposalDocumentAnalysis, type ProposalAnalysisDocument } from "@/app/proposals/proposal-document-analysis";

type LinkedTender = { id: string; versionId: string; fileHash: string };
type ArchiveMatch = {
  serviceId: string;
  discipline: string;
  description: string;
  characteristics: string;
  quantities: Array<{ value: string; unit: string; source: string }>;
  contract: { code: string; subject: string; contractorName: string };
  evidence: { title: string; versionId: string; version: number; fileHash: string };
  matchedKeywords: string[];
  score: number;
};

export function ProposalWorkspace({
  proposalId,
  proposalCode,
  canUploadDocuments,
  extractionDefinitions,
}: {
  proposalId: string;
  proposalCode: string;
  canUploadDocuments: boolean;
  extractionDefinitions: ProposalExtractionDefinitions;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [documents, setDocuments] = useState<ProposalAnalysisDocument[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [archiveMatches, setArchiveMatches] = useState<ArchiveMatch[]>([]);
  const [linkedTender, setLinkedTender] = useState<LinkedTender | null>(null);
  const [promotingTender, setPromotingTender] = useState(false);

  async function load() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/proposals/${proposalId}/analysis`, { cache: "no-store" });
      const payload = (await response.json()) as {
        data?: { documents?: ProposalAnalysisDocument[]; archiveMatches?: ArchiveMatch[]; tender?: LinkedTender | null; ownerId?: string | null };
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message ?? "Não foi possível consultar a proposta.");
      setDocuments(payload.data?.documents ?? []);
      setOwnerId(payload.data?.ownerId ?? "");
      setArchiveMatches(payload.data?.archiveMatches ?? []);
      setLinkedTender(payload.data?.tender ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na consulta.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId]);

  async function promoteTender(documentVersionId: string) {
    setPromotingTender(true);
    setMessage("");
    try {
      const response = await fetch(`/api/proposals/${proposalId}/tender-link`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentVersionId }),
      });
      const payload = (await response.json()) as { data?: { tenderId?: string; tenderVersionId?: string; code?: string }; error?: { message?: string } };
      if (!response.ok || !payload.data?.tenderId || !payload.data.tenderVersionId) throw new Error(payload.error?.message ?? "Não foi possível vincular o edital.");
      setLinkedTender({ id: payload.data.tenderId, versionId: payload.data.tenderVersionId, fileHash: documents.find((item) => item.versionId === documentVersionId)?.fileHash ?? "" });
      setMessage(`Edital ${payload.data.code ?? ""} vinculado. O arquivo original foi preservado e já pode receber requisitos.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao vincular o edital.");
    } finally {
      setPromotingTender(false);
    }
  }

  return (
    <>
      {linkedTender ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div><p className="text-xs font-black uppercase text-emerald-700">Edital vinculado</p><p className="text-[11px] text-slate-500">Original preservado; requisitos e matriz liberados.</p></div>
          <Link className="ml-auto rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-700" href={`/tenders/${linkedTender.id}`}>Abrir edital</Link>
        </div>
      ) : documents.some((document) => document.type === "EDITAL" && document.versionId) ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
          <div><p className="text-xs font-black uppercase text-brand">Edital encontrado na proposta</p><p className="text-[11px] text-slate-500">Reutilize o documento sem fazer novo upload.</p></div>
          <button
            className="ml-auto rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            disabled={promotingTender}
            onClick={() => {
              const versionId = documents.find((document) => document.type === "EDITAL")?.versionId;
              if (versionId) void promoteTender(versionId);
            }}
            type="button"
          >
            {promotingTender ? "Vinculando…" : "Usar como edital"}
          </button>
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand">Documentação da proposta</p>
            <h2 className="mt-1 text-xl font-bold">Arquivos e análises do contexto</h2>
            <p className="mt-1 text-sm text-muted">Resumo dos arquivos vinculados exclusivamente a esta proposta.</p>
          </div>
        </div>

        {canUploadDocuments && ownerId && (
          <div className="mt-4">
            <ContextDocumentUploader
              contextLabel={`proposta ${proposalCode}`}
              entityId={proposalId}
              entityType="PROPOSAL"
              extractionDefinitions={extractionDefinitions}
              onCompleted={() => load()}
              ownerId={ownerId}
            />
          </div>
        )}

        {busy && <p className="mt-4 rounded-xl bg-blue-50 p-4 text-sm font-bold text-brand">Carregando análise…</p>}
        {message && <p className="mt-4 rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{message}</p>}
        {!busy && !message && documents.length === 0 && <p className="mt-4 rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-500">Esta proposta ainda não possui documentos vinculados.</p>}

        <div className="mt-4 grid gap-4">
          {documents.map((document) => <ProposalDocumentAnalysis document={document} key={document.id} />)}
        </div>

        {!busy && (
          <section className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Cruzamento assistivo</p>
                <h3 className="mt-1 text-lg font-black">Correspondências no acervo técnico</h3>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{archiveMatches.length} resultado(s)</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Similaridade textual com serviços validados. Não representa aprovação automática de capacidade técnica.</p>
            <div className="mt-3 grid gap-3">
              {archiveMatches.map((match) => (
                <article className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4" key={match.serviceId}>
                  <div className="flex flex-wrap justify-between gap-2">
                    <div><p className="text-xs font-bold text-emerald-700">{match.discipline} · {match.contract.code}</p><h4 className="mt-1 font-bold">{match.description}</h4></div>
                    <span className="text-xs font-bold text-slate-500">{match.matchedKeywords.length} termo(s) coincidente(s)</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600"><strong>Características:</strong> {match.characteristics}</p>
                  <div className="mt-3 overflow-hidden rounded-lg border border-emerald-100 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-emerald-50 text-emerald-800"><tr><th className="p-2">Quantidade</th><th className="p-2">Unidade</th><th className="p-2">Fonte</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {match.quantities.map((quantity, index) => (
                          <tr key={`${quantity.value}-${quantity.unit}-${index}`}><td className="p-2 font-bold">{quantity.value}</td><td className="p-2">{quantity.unit}</td><td className="p-2">{quantity.source}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>{match.evidence.title} · versão {match.evidence.version}</span>
                    <a className="font-bold text-brand" href={`/api/documents/versions/${match.evidence.versionId}/content`} rel="noreferrer" target="_blank">Abrir atestado</a>
                  </div>
                </article>
              ))}
              {archiveMatches.length === 0 && <p className="rounded-xl border border-slate-200 p-5 text-center text-sm text-slate-500">Nenhuma correspondência automática encontrada ou o usuário não possui permissão de pesquisa no acervo.</p>}
            </div>
          </section>
        )}
      </section>
    </>
  );
}
