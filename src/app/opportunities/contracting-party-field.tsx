"use client";

import { useEffect, useRef, useState } from "react";

export type PartyKind = "AUTHORITY" | "CUSTOMER";
export type Party = Readonly<{ id: string; name: string; kind: PartyKind }>;

type SearchResult = Readonly<{ id: string; name: string }>;
type Result = SearchResult & Readonly<{ kind: PartyKind }>;

/**
 * Campo único de cliente/órgão: busca nos dois cadastros mestre
 * (contracting-authorities e customers) e, sem resultado, cadastra na hora —
 * é a peça que faltava para "Validar e avançar" deixar de travar em
 * oportunidades cujo órgão não veio pré-cadastrado da varredura.
 */
export function ContractingPartyField({ initialParty, disabled = false }: { initialParty?: Party; disabled?: boolean }) {
  const [selected, setSelected] = useState<Party | undefined>(initialParty);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly Result[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    // Resultado velho não aparece: o dropdown só é renderizado com
    // query.trim().length >= 2, então não precisa limpar `results` aqui
    // (e limpar num efeito síncrono é o que o react-hooks/set-state-in-effect
    // está de olho).
    if (trimmed.length < 2) return;
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const [authorities, customers] = await Promise.all([
            fetch(`/api/contracting-authorities?q=${encodeURIComponent(trimmed)}`).then((response) => response.json()),
            fetch(`/api/customers?q=${encodeURIComponent(trimmed)}`).then((response) => response.json()),
          ]);
          if (id !== requestId.current) return;
          setResults([
            ...((authorities.data ?? []) as readonly SearchResult[]).map((item) => ({ ...item, kind: "AUTHORITY" as const })),
            ...((customers.data ?? []) as readonly SearchResult[]).map((item) => ({ ...item, kind: "CUSTOMER" as const })),
          ]);
        } catch {
          if (id === requestId.current) setResults([]);
        }
      })();
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function createParty(kind: PartyKind) {
    const name = query.trim();
    if (name.length < 2) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(kind === "AUTHORITY" ? "/api/contracting-authorities" : "/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json()) as { data?: { id: string; name: string }; error?: { message?: string } };
      if (!response.ok || !payload.data) {
        setError(payload.error?.message ?? "Não foi possível cadastrar.");
        return;
      }
      setSelected({ id: payload.data.id, name: payload.data.name, kind });
      setQuery("");
      setResults([]);
      setOpen(false);
    } catch {
      setError("Falha de conexão ao cadastrar.");
    } finally {
      setBusy(false);
    }
  }

  if (selected) {
    return (
      <div className="grid gap-1 text-sm font-semibold">
        Cliente/órgão
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-slate-50 px-3 py-2">
          <span className="font-normal text-slate-800">
            {selected.name}
            <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {selected.kind === "AUTHORITY" ? "Órgão" : "Cliente"}
            </span>
          </span>
          {!disabled && (
            <button
              className="text-xs font-bold text-brand"
              onClick={() => { setSelected(undefined); setQuery(""); setResults([]); }}
              type="button"
            >
              Trocar
            </button>
          )}
        </div>
        <input name={selected.kind === "AUTHORITY" ? "contractingAuthorityId" : "customerId"} type="hidden" value={selected.id} />
      </div>
    );
  }

  return (
    <div className="relative grid gap-1 text-sm font-semibold">
      Cliente/órgão
      <input
        className="rounded-xl border border-border px-3 py-2 font-normal"
        disabled={disabled}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Digite o nome do cliente ou órgão…"
        type="text"
        value={query}
      />
      {open && query.trim().length >= 2 && (
        <div className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded-xl border border-border bg-white shadow-lg">
          <div className="max-h-56 overflow-y-auto">
            {results.map((item) => (
              <button
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                key={`${item.kind}-${item.id}`}
                onMouseDown={() => { setSelected({ id: item.id, name: item.name, kind: item.kind }); setOpen(false); }}
                type="button"
              >
                <span className="font-normal text-slate-800">{item.name}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{item.kind === "AUTHORITY" ? "Órgão" : "Cliente"}</span>
              </button>
            ))}
            {results.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-500">Nenhum resultado.</p>
            )}
          </div>
          <div className="border-t border-border bg-slate-50 p-2">
            <p className="px-1 pb-1 text-xs text-slate-500">Não encontrou? Cadastrar novo:</p>
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-bold hover:bg-slate-50 disabled:opacity-60"
                disabled={busy}
                onMouseDown={() => createParty("AUTHORITY")}
                type="button"
              >
                + Órgão público
              </button>
              <button
                className="flex-1 rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-bold hover:bg-slate-50 disabled:opacity-60"
                disabled={busy}
                onMouseDown={() => createParty("CUSTOMER")}
                type="button"
              >
                + Cliente privado
              </button>
            </div>
          </div>
        </div>
      )}
      {error && <p className="text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}
