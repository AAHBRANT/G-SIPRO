"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuthoritySuggestion({ opportunityId, suggestedName, raw }: { opportunityId: string; suggestedName: string; raw: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function apply() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ authorityNameHint: raw }),
      });
      const result = (await response.json()) as { error?: { message?: string } };
      setBusy(false);
      if (!response.ok) {
        setMessage(result.error?.message ?? "Não foi possível vincular o órgão.");
        return;
      }
      router.refresh();
    } catch {
      setBusy(false);
      setMessage("Falha de conexão. Verifique sua rede e tente novamente.");
    }
  }

  return (
    <div className="border-t border-amber-200 bg-amber-50 p-4">
      <p className="text-sm text-amber-950">
        Encontramos um possível órgão contratante nos documentos analisados: <strong>{suggestedName}</strong>.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button className="rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-60" disabled={busy} onClick={apply} type="button">
          {busy ? "Vinculando…" : "Vincular este órgão"}
        </button>
        {message && <p className="text-xs font-semibold text-red-700">{message}</p>}
      </div>
    </div>
  );
}
