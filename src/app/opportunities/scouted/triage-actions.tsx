"use client";

import { useRouter } from "next/navigation";
import { type MouseEvent, useState, useTransition } from "react";

/**
 * Decisão humana sobre uma licitação rastreada. Aprovar cria a oportunidade e
 * leva direto a ela; descartar exige motivo, que fica registrado no histórico.
 */
export function TriageActions({ id }: { id: string }) {
  const router = useRouter();
  const [discarding, setDiscarding] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  /**
   * O bloco de decisão vive dentro do <summary> da linha, e alternar a sanfona
   * é a ação padrão do clique ali: sem este guarda, aprovar ou descartar abriria
   * o detalhe junto. O guarda precisa morar aqui, no cliente — componente de
   * servidor não pode carregar manipulador de evento, e tentar isso derruba a
   * renderização da fila inteira.
   */
  const stopToggle = (event: MouseEvent<HTMLDivElement>) => { event.preventDefault(); };

  function decide(body: Record<string, unknown>, onDone: (payload: { opportunityId?: string }) => void) {
    setError(undefined);
    startTransition(async () => {
      const response = await fetch(`/api/scouting/scouted-tenders/${id}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(response.status === 409 ? "Esta licitação já foi triada." : "Não foi possível registrar a decisão.");
        return;
      }
      const payload = await response.json().catch(() => ({ data: {} }));
      onDone(payload.data ?? {});
    });
  }

  if (discarding) {
    return <div className="bx-acao" onClick={stopToggle}>
      <label className="sr-only" htmlFor={`reason-${id}`}>Motivo do descarte</label>
      <input
        autoFocus
        className="bx-campo"
        id={`reason-${id}`}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Motivo do descarte"
        value={reason}
      />
      <div className="par">
        <button
          className="bx-bt sim"
          disabled={pending || reason.trim().length < 3}
          onClick={() => decide({ decision: "DISCARD", reason: reason.trim() }, () => router.refresh())}
          type="button"
        >Confirmar</button>
        <button className="bx-bt nao" onClick={() => { setDiscarding(false); setReason(""); }} type="button">Cancelar</button>
      </div>
      {error && <span className="bx-erro">{error}</span>}
    </div>;
  }

  return <div className="bx-acao" onClick={stopToggle}>
    <div className="par">
      <button
        className="bx-bt sim"
        disabled={pending}
        onClick={() => decide({ decision: "APPROVE" }, (payload) => {
          if (payload.opportunityId) router.push(`/opportunities/${payload.opportunityId}`);
          else router.refresh();
        })}
        type="button"
      >{pending ? "…" : "Aprovar"}</button>
      <button className="bx-bt nao" disabled={pending} onClick={() => setDiscarding(true)} type="button">Descartar</button>
    </div>
    {error && <span className="bx-erro">{error}</span>}
  </div>;
}
