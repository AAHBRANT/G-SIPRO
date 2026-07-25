import {
  buildProposalAnalysisSummary,
  compactProposalAnalysisValue,
  parseProposalAnalysisFields,
} from "./proposal-analysis-summary";

export type ProposalAnalysisDocument = {
  id: string;
  type: string;
  title: string;
  versionId?: string;
  version?: number;
  fileHash?: string;
  analysis: null | {
    id: string;
    status: string;
    output: unknown;
    confidence: string | null;
    limitations: unknown;
    errorMessage: string | null;
    evidence: Array<{ excerpt: string; locator: string }>;
  };
};

export function ProposalDocumentAnalysis({ document }: { document: ProposalAnalysisDocument }) {
  const fields = parseProposalAnalysisFields(document.analysis?.output);
  const summary = buildProposalAnalysisSummary(fields);
  const confidence = document.analysis?.confidence
    ? `${Math.round(Number(document.analysis.confidence) * 100)}%`
    : null;

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4">
        <div>
          <p className="text-xs font-bold text-brand">
            {document.type} · versão {document.version ?? "—"}
          </p>
          <h3 className="font-bold">{document.title}</h3>
          <p className="mt-1 text-[11px] text-slate-500">
            Somente informações extraídas deste arquivo vinculado à proposta.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {document.versionId && (
            <a
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-brand"
              href={`/api/documents/versions/${document.versionId}/content`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir original
            </a>
          )}
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${document.analysis?.status === "SUCCEEDED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {document.analysis?.status === "SUCCEEDED"
              ? "Analisado"
              : document.analysis?.status ?? "Sem análise"}
          </span>
        </div>
      </header>

      {document.analysis?.errorMessage && (
        <p className="m-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
          {document.analysis.errorMessage}
        </p>
      )}

      {summary.length > 0 && (
        <section className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-800">
                Resumo executivo
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Itens padrão priorizados para reduzir o tempo de leitura.
              </p>
            </div>
            {confidence && (
              <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-blue-700">
                Confiança {confidence}
              </span>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {summary.map((item, index) => (
              <article className="rounded-xl border border-slate-200 bg-white p-3" key={`${item.field}-${index}`}>
                <p className="text-[9px] font-black uppercase tracking-wider text-brand">
                  {item.category}
                </p>
                <h4 className="mt-1 text-xs font-bold text-slate-800">{item.field}</h4>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {compactProposalAnalysisValue(item.value)}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {fields.length > 0 && (
        <details className="border-t border-slate-200 p-4">
          <summary className="cursor-pointer text-xs font-bold text-brand">
            Consultar análise completa ({fields.length} itens)
          </summary>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Item analisado</th>
                  <th className="p-3">Resultado encontrado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fields.map((field, index) => (
                  <tr key={`${field.field}-${index}`}>
                    <td className="p-3 font-semibold">{field.field}</td>
                    <td className="whitespace-pre-wrap p-3">{field.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {document.analysis?.evidence.length ? (
        <details className="border-t border-slate-200 p-4">
          <summary className="cursor-pointer text-xs font-bold text-brand">
            Consultar evidências e páginas ({document.analysis.evidence.length})
          </summary>
          <div className="mt-3 grid gap-2">
            {document.analysis.evidence.map((evidence, index) => (
              <blockquote
                className="border-l-4 border-blue-200 pl-3 text-xs text-slate-600"
                key={`${evidence.locator}-${index}`}
              >
                {evidence.excerpt} <strong>— {evidence.locator}</strong>
              </blockquote>
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}
