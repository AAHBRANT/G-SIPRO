"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";

type Field = { field: string; value: string };
type Service = { discipline: string; description: string; quantities: string };
export type ArchiveItem = {
  id: string; versionId: string; title: string; owner: string; version: number; mimeType: string; size: string; hash: string; origin: string; createdAt: string;
  number?: string; issuer?: string; subject?: string; contractor?: string; services: Service[]; fields: Field[]; extractionStatus?: string; extractionError?: string;
};

function extractionPresentation(item: ArchiveItem) {
  if (item.extractionStatus === "RUNNING") return { label: "Processando", classes: "bg-blue-50 text-blue-700" };
  if (item.extractionStatus === "FAILED") return { label: "Falha", classes: "bg-red-50 text-red-700" };
  if (item.extractionStatus === "SUCCEEDED" && item.fields.length === 0) return { label: "Reconhecido parcialmente", classes: "bg-amber-50 text-amber-700" };
  if (item.extractionStatus === "SUCCEEDED") return { label: "Reconhecido", classes: "bg-emerald-50 text-emerald-700" };
  return { label: "Importado", classes: "bg-amber-50 text-amber-700" };
}

export function ArchiveWorkspace({ items, users, canCreate, extractionDefinitionId }: { items: ArchiveItem[]; users: { id: string; name: string }[]; canCreate: boolean; extractionDefinitionId?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const selected = items.find((item) => item.versionId === selectedVersionId) ?? null;
  const setSelected = (item: ArchiveItem | null) => setSelectedVersionId(item?.versionId ?? null);
  const [insideQuery, setInsideQuery] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState("");
  const [message, setMessage] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return items;
    return items.filter(item => [item.title, item.owner, item.number, item.issuer, item.subject, item.contractor, ...item.fields.flatMap(field => [field.field, field.value]), ...item.services.flatMap(service => [service.discipline, service.description, service.quantities])].join(" ").toLocaleLowerCase("pt-BR").includes(normalized));
  }, [items, query]);
  const selectedMatches = useMemo(() => {
    if (!selected || !insideQuery.trim()) return selected?.fields ?? [];
    const normalized = insideQuery.toLocaleLowerCase("pt-BR");
    return selected.fields.filter(field => `${field.field} ${field.value}`.toLocaleLowerCase("pt-BR").includes(normalized));
  }, [insideQuery, selected]);
  const recognized = items.filter(item => item.extractionStatus === "SUCCEEDED" && item.fields.length > 0).length;
  const services = items.reduce((sum, item) => sum + item.services.length, 0);
  const issuers = new Set(items.map(item => item.issuer ?? item.contractor).filter(Boolean)).size;

  async function recognize(versionId: string) {
    if (!extractionDefinitionId) throw new Error("O reconhecimento inteligente ainda não está configurado para este ambiente.");
    const extraction = await fetch("/api/ai-extractions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        definitionId: extractionDefinitionId,
        documentVersionId: versionId,
        requestedFields: ["Contratante", "Objeto", "Local da obra", "Período de execução", "Emissor", "Profissionais e registros", "Serviços executados e quantidades"],
        instructions: "Extraia somente informações presentes no atestado. No campo 'Serviços executados e quantidades', devolva uma string JSON válida contendo um array de objetos com as chaves disciplina, servico, quantidade e unidade. Não avalie, não audite e não aprove o documento.",
      }),
    });
    const result = await extraction.json().catch(() => undefined) as { data?: { status?: string; errorMessage?: string }; error?: { message?: string } } | undefined;
    if (!extraction.ok) throw new Error(result?.error?.message ?? "O reconhecimento inteligente não foi concluído.");
    if (result?.data?.status === "FAILED") throw new Error(result.data.errorMessage ?? "A inteligência não conseguiu concluir o reconhecimento.");
    if (result?.data?.status !== "SUCCEEDED") throw new Error("O reconhecimento não chegou ao estado concluído.");
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); form.set("type", "ATESTADO"); form.set("classification", "PUBLIC"); setBusy(true); setMessage("Enviando o arquivo original…");
    try {
      const response = await fetch("/api/documents", { method: "POST", body: form });
      const result = await response.json() as { data?: { version?: { id?: string } }; error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Não foi possível importar o acervo.");
      const versionId = result.data?.version?.id;
      if (versionId && extractionDefinitionId) {
        setMessage("Arquivo preservado. Reconhecendo informações do atestado…");
        await recognize(versionId);
        setMessage("Acervo importado e informações reconhecidas. Revise os dados apresentados.");
      } else setMessage("Acervo importado. O reconhecimento será iniciado automaticamente assim que a configuração administrativa estiver ativa.");
      formElement.reset(); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha na importação."); } finally { setBusy(false); }
  }

  async function recognizeSelected() {
    if (!selected) return;
    setBusy(true);
    setDownloadMessage("Reconhecendo informações do atestado…");
    try {
      await recognize(selected.versionId);
      setDownloadMessage("Reconhecimento concluído. Os dados serão atualizados.");
      router.refresh();
    } catch (error) {
      setDownloadMessage(error instanceof Error ? error.message : "Falha no reconhecimento.");
    } finally { setBusy(false); }
  }

  async function downloadOriginal(item: ArchiveItem) {
    setDownloadBusy(true);
    setDownloadMessage("");
    try {
      const response = await fetch(`/api/documents/versions/${item.versionId}/content`, {
        credentials: "same-origin",
      });
      if (!response.ok) {
        const result = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined;
        throw new Error(result?.error?.message ?? "Não foi possível acessar o arquivo original.");
      }
      const blobUrl = URL.createObjectURL(await response.blob());
      const extension = item.mimeType === "application/pdf" ? ".pdf" : "";
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = `${item.title.replace(/[^\p{L}\p{N}._-]+/gu, "-")}${extension}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
      setDownloadMessage("Arquivo original disponibilizado com segurança.");
    } catch (error) {
      setDownloadMessage(error instanceof Error ? error.message : "Falha ao acessar o arquivo original.");
    } finally {
      setDownloadBusy(false);
    }
  }

  return <>
    <PageHeader action={canCreate ? <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-bold text-white shadow-md shadow-blue-900/15 transition hover:-translate-y-0.5 hover:bg-blue-700" onClick={() => setShowUpload(true)}><span className="text-lg font-normal">＋</span> Importar e reconhecer</button> : undefined} eyebrow="Acervo técnico" icon="pipeline" subtitle="Importe o atestado uma vez; o sistema preserva o original e reconhece automaticamente as informações autorizadas." title="Acervo técnico"/>
    <section aria-label="Indicadores do acervo técnico" className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4"><MetricCard description="Documentos técnicos preservados" icon="file" title="Total de acervos" tone="blue" value={items.length}/><MetricCard description="Documentos processados pela inteligência" icon="target" title="Acervos reconhecidos" tone="green" value={recognized}/><MetricCard description="Serviços executados identificados" icon="chart" title="Serviços cadastrados" tone="violet" value={services}/><MetricCard description="Contratantes ou emissores identificados" icon="money" title="Emissores distintos" tone="amber" value={issuers}/></section>
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_3px_14px_rgba(15,23,42,0.05)]">
      <div className="relative flex-1"><span className="pointer-events-none absolute left-4 top-3 text-slate-400">⌕</span><input className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm" onChange={event => setQuery(event.target.value)} placeholder="Pesquisar objeto, serviço, quantidade, contratante ou palavra-chave em todos os acervos" value={query}/></div>
    </div>

    {showUpload && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Importar novo acervo"><div className="mx-auto my-8 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-brand">Acervo técnico</p><h2 className="mt-1 text-2xl font-black">Importar novo acervo</h2><p className="mt-1 text-sm text-slate-500">O original será preservado e a IA somente reconhecerá informações; não fará auditoria ou aprovação.</p></div><button aria-label="Fechar importação" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-xl" onClick={() => setShowUpload(false)} type="button">×</button></div><form className="mt-5 grid gap-4" onSubmit={upload}><div className="grid gap-3 md:grid-cols-2"><input className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" name="title" placeholder="Título do acervo" required/><select className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" name="ownerId" required>{users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select><input className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" defaultValue="Acervo técnico da empresa" name="origin" placeholder="Origem do documento" required/><input accept=".pdf,.doc,.docx,.txt" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" name="file" type="file" required/></div><div className="flex items-center gap-3"><button className="rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50" disabled={busy}>{busy ? "Processando…" : "Importar e reconhecer"}</button>{message && <p className="text-sm font-semibold text-slate-600" role="status">{message}</p>}</div></form></div></div>}

    <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_3px_14px_rgba(15,23,42,0.05)]"><div className="flex items-center justify-between border-b border-slate-200 px-6 py-5"><div><h2 className="text-base font-black uppercase tracking-wide">Relação de acervos</h2><p className="mt-1 text-xs text-slate-500">{filtered.length} de {items.length} documentos</p></div></div><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Documento</th><th className="px-4 py-3">Contratante / emissor</th><th className="px-4 py-3">Objeto</th><th className="px-4 py-3">Serviços</th><th className="px-4 py-3">Situação</th><th className="px-5 py-3 text-center">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(item => { const status = extractionPresentation(item); return <tr className="cursor-pointer transition hover:bg-blue-50/50" key={item.id} onClick={() => { setSelected(item); setInsideQuery(""); }}><td className="px-5 py-4"><p className="font-bold text-slate-900">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.number ? `Nº ${item.number} · ` : ""}v{item.version} · {item.createdAt}</p></td><td className="px-4 py-4 text-slate-600">{item.contractor ?? item.issuer ?? "A reconhecer"}</td><td className="max-w-xs px-4 py-4 text-slate-600"><p className="line-clamp-2">{item.subject ?? "A reconhecer"}</p></td><td className="px-4 py-4"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-brand">{item.services.length}</span></td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.classes}`}>{status.label}</span></td><td className="px-5 py-4 text-center"><button className="rounded-lg px-3 py-2 text-xs font-bold text-brand hover:bg-blue-50">Visualizar</button></td></tr>; })}{!filtered.length && <tr><td className="px-5 py-12 text-center text-slate-400" colSpan={6}>Nenhum acervo encontrado para esta pesquisa.</td></tr>}</tbody></table></div></section>

    {selected && <div className="fixed inset-0 z-50 bg-slate-950/35" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}><aside className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-2xl"><header className="flex items-start justify-between border-b border-slate-200 p-5"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-brand">Acervo técnico</p><h2 className="mt-1 truncate text-xl font-black">{selected.title}</h2><p className="mt-1 text-xs text-slate-500">Versão {selected.version} · SHA {selected.hash.slice(0, 12)}…</p></div><button aria-label="Fechar painel" className="rounded-lg border border-slate-200 px-3 py-2" onClick={() => setSelected(null)}>✕</button></header><div className="flex-1 overflow-y-auto p-5"><div className="flex flex-wrap items-center gap-3"><button className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" disabled={downloadBusy} onClick={() => downloadOriginal(selected)} type="button">{downloadBusy ? "Preparando arquivo…" : "Baixar arquivo original"}</button>{selected.extractionStatus !== "SUCCEEDED" && selected.extractionStatus !== "RUNNING" && extractionDefinitionId && <button className="rounded-xl border border-brand px-4 py-2.5 text-sm font-bold text-brand disabled:opacity-50" disabled={busy} onClick={recognizeSelected} type="button">{busy ? "Reconhecendo…" : selected.extractionStatus === "FAILED" ? "Tentar novamente" : "Reconhecer agora"}</button>}{downloadMessage && <p className="w-full text-xs font-semibold text-slate-600" role="status">{downloadMessage}</p>}{selected.extractionStatus === "FAILED" && selected.extractionError && <p className="w-full rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">Não foi possível reconhecer este arquivo: {selected.extractionError}</p>}</div>{selected.mimeType === "application/pdf" && <iframe className="mt-5 h-[420px] w-full rounded-xl border border-slate-200" src={`/api/documents/versions/${selected.versionId}/content`} title={`Visualização de ${selected.title}`}/>}<div className="mt-5"><label className="text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="inside-search">Pesquisar neste acervo</label><input className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm" id="inside-search" onChange={event => setInsideQuery(event.target.value)} placeholder="Serviço, quantidade ou expressão" value={insideQuery}/></div><dl className="mt-5 grid gap-3 sm:grid-cols-2">{selectedMatches.map((field, index) => <div className="rounded-xl bg-slate-50 p-3" key={`${field.field}-${index}`}><dt className="text-xs font-bold text-slate-500">{field.field}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{field.value}</dd></div>)}</dl>{selected.services.length > 0 && <div className="mt-6"><h3 className="font-black">Serviços executados e quantidades</h3><div className="mt-3 overflow-hidden rounded-xl border border-slate-200"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">Disciplina</th><th className="p-3">Serviço</th><th className="p-3">Quantidade</th></tr></thead><tbody className="divide-y divide-slate-100">{selected.services.map((service, index) => <tr key={index}><td className="p-3 font-semibold">{service.discipline}</td><td className="p-3">{service.description}</td><td className="p-3">{service.quantities}</td></tr>)}</tbody></table></div></div>}</div></aside></div>}
  </>;
}
