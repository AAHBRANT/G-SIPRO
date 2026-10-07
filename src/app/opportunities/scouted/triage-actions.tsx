"use client";

import { useRouter } from "next/navigation";
import { type MouseEvent, useState, useTransition } from "react";

export type Decisao = Readonly<{ decision: "APPROVE"; opportunityId?: string } | { decision: "DISCARD" }>;

/**
 * Decisão humana sobre uma licitação rastreada. Aprovar cria a oportunidade e
 * leva direto a ela; descartar exige motivo, que fica registrado no histórico.
 *
 * `onDecided`, quando informado, substitui esse destino padrão — é o que a
 * janelinha do mapa da Análise usa para fechar e atualizar no lugar, em vez
 * de arrancar a pessoa da tela de Análise para a de Oportunidades.
 */
export function TriageActions({ id, onDecided }: { id: string; onDecided?: (decisao: Decisao) => void }) {
  const router = useRouter();
  const [discarding, setDiscarding] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  /**
   * Decisão já registrada: os botões saem na hora, sem esperar a fila
   * recarregar. Antes disto a linha continuava oferecendo Aprovar/Descartar
   * enquanto a página não era refeita — e voltar para a fila podia mostrar a
   * versão guardada pelo navegador, com a licitação ainda "pendente".
   */
  const [decided, setDecided] = useState<string>();
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
      if (response.status === 409) {
        // Já decidida por outro clique ou outra pessoa: some da fila também.
        setDecided("Esta licitação já foi triada.");
        router.refresh();
        return;
      }
      if (!response.ok) {
        const failure = await response.json().catch(() => undefined);
        setError(failure?.error?.message ?? "Não foi possível registrar a decisão.");
        return;
      }
      const payload = await response.json().catch(() => ({ data: {} }));
      setDecided(body.decision !== "APPROVE"
        ? "Descartada."
        : payload.data?.reaproveitada
          ? "Esta obra já tinha sido aprovada — abrindo a oportunidade existente."
          : "Aprovada — virou oportunidade.");
      // Invalida a fila guardada no navegador antes de sair dela.
      router.refresh();
      onDone(payload.data ?? {});
    });
  }

  if (decided) {
    return <div className="bx-acao" onClick={stopToggle}><span className="bx-local block text-center">{decided}</span></div>;
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
          onClick={() => decide({ decision: "DISCARD", reason: reason.trim() }, () => (onDecided ? onDecided({ decision: "DISCARD" }) : router.refresh()))}
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
          if (onDecided) { onDecided({ decision: "APPROVE", ...(payload.opportunityId ? { opportunityId: payload.opportunityId } : {}) }); return; }
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
