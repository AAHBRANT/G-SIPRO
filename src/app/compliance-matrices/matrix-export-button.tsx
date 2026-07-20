"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function MatrixExportButton({ matrixId }: { matrixId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function finalize() {
    setBusy(true);
    const response = await fetch(`/api/compliance-matrices/${matrixId}/finalize`, { method: "POST" });
    const result = await response.json() as { data?: { downloadUrl?: string }; error?: { message?: string } };
    setBusy(false);
    if (!response.ok) { setMessage(result.error?.message ?? "Falha ao consolidar a matriz."); return; }
    setMessage("Matriz consolidada e exportação íntegra gerada.");
    router.refresh();
    if (result.data?.downloadUrl) window.location.assign(result.data.downloadUrl);
  }
  return <div className="grid gap-1"><button className="rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white" disabled={busy} onClick={finalize} type="button">{busy ? "Consolidando…" : "Consolidar e exportar JSON"}</button>{message && <p className="text-xs text-muted" role="status">{message}</p>}</div>;
}

