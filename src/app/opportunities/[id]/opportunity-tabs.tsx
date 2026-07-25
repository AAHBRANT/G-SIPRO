"use client";

import { useState, type ReactNode } from "react";

export function OpportunityTabs({
  summary,
  documents,
}: {
  summary: ReactNode;
  documents: ReactNode;
}) {
  const [active, setActive] = useState<"summary" | "documents">("summary");

  return (
    <div>
      <div className="mb-5 flex gap-1 border-b border-slate-200" role="tablist" aria-label="Seções da oportunidade">
        <button
          aria-selected={active === "summary"}
          className={`border-b-2 px-4 py-3 text-sm font-bold transition ${active === "summary" ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          onClick={() => setActive("summary")}
          role="tab"
          type="button"
        >
          Visão resumida
        </button>
        <button
          aria-selected={active === "documents"}
          className={`border-b-2 px-4 py-3 text-sm font-bold transition ${active === "documents" ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          onClick={() => setActive("documents")}
          role="tab"
          type="button"
        >
          Documentos e análises
        </button>
      </div>
      <div role="tabpanel">{active === "summary" ? summary : documents}</div>
    </div>
  );
}
