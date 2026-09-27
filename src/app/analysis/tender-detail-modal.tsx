"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { OpportunityEditor, type OpportunityEditorData } from "@/app/opportunities/[id]/opportunity-editor";
import { TenderDetailPanel, TenderSummaryHeader } from "@/app/opportunities/scouted/tender-detail-panel";
import type { ScoredTender } from "@/modules/scouting/application/score-tender";
import "@/app/analysis/analise.css";

type PendingData = Readonly<{
  tender: ScoredTender;
  canDecide: boolean;
  shareRecipients: readonly { id: string; email: string; label: string }[];
  duplicateCount: number;
}>;

type ApprovedData = Readonly<{
  opportunity: OpportunityEditorData;
  users: readonly { id: string; name: string }[];
  canUpdate: boolean;
  canTransition: boolean;
}>;

/**
 * Janelinha que o mapa da Análise abre por cima de si mesmo, ao clicar numa
 * licitação da lista "Licitações deste recorte" — pedido de 26/09/2026: "que
 * ele consiga fazer todo esse manejo por lá também". Duas licitações
 * diferentes moram aqui:
 *
 * - Ainda não decidida: mesmo cabeçalho + abas + Aprovar/Descartar da fila do
 *   Buscador (`TenderSummaryHeader`/`TenderDetailPanel`), buscados sob
 *   pedido — a página da Análise não carrega esse pacote de graça.
 * - Já aprovada (virou oportunidade): a mesma tela de editar oportunidade
 *   (`OpportunityEditor`) — decisão explícita do dono de não fazer um resumo
 *   simplificado aqui.
 *
 * Fechar não precisa atualizar nada sozinho: `TriageActions`/`OpportunityEditor`
 * já chamam `router.refresh()` nas próprias ações — este componente só reage
 * fechando, sem duplicar essa responsabilidade.
 */
export function TenderDetailModal({
  tenderId, opportunityId, onClose,
}: {
  tenderId: string;
  opportunityId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingData | undefined>();
  const [approved, setApproved] = useState<ApprovedData | undefined>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    // Sem reset aqui: o modal nasce e morre com `selecionado` em
    // mapa-territorio.tsx (o pai desmonta ao fechar), então cada instância já
    // começa com os estados no valor inicial — zerar de novo é que dispararia
    // o aviso de setState síncrono dentro de efeito.
    let cancelado = false;
    (async () => {
      try {
        if (opportunityId) {
          const response = await fetch(`/api/opportunities/${opportunityId}`);
          const payload = await response.json();
          if (cancelado) return;
          if (!response.ok) { setError(payload.error?.message ?? "Não foi possível carregar a oportunidade."); return; }
          setApproved(payload.data);
        } else {
          const response = await fetch(`/api/scouting/scouted-tenders/${tenderId}`);
          const payload = await response.json();
          if (cancelado) return;
          if (!response.ok) { setError(payload.error?.message ?? "Não foi possível carregar a licitação."); return; }
          setPending(payload.data);
        }
      } catch {
        if (!cancelado) setError("Falha de conexão.");
      }
    })();
    return () => { cancelado = true; };
  }, [tenderId, opportunityId]);

  return (
    <div className="an-modal-fundo" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} role="presentation">
      <div aria-label={opportunityId ? "Gerenciar oportunidade" : "Licitação rastreada"} aria-modal="true" className="an-modal-caixa" role="dialog">
        <button aria-label="Fechar" className="an-modal-fechar" onClick={onClose} type="button">✕</button>

        {error && <p className="an-sem">{error}</p>}

        {!error && !pending && !approved && <p className="an-ajuda">Carregando…</p>}

        {pending && (
          <div className="bx" style={{ background: "none", minHeight: 0, padding: 0 }}>
            <div className="bx-linha">
              <div className="bx-cab">
                <TenderSummaryHeader
                  canDecide={pending.canDecide}
                  duplicateCount={pending.duplicateCount}
                  onDecided={() => { onClose(); router.refresh(); }}
                  shareRecipients={pending.shareRecipients}
                  tender={pending.tender}
                />
              </div>
              <div className="bx-painel">
                <TenderDetailPanel tender={pending.tender}/>
              </div>
            </div>
          </div>
        )}

        {approved && (
          <OpportunityEditor
            canTransition={approved.canTransition}
            canUpdate={approved.canUpdate}
            opportunity={approved.opportunity}
            users={approved.users}
          />
        )}
      </div>
    </div>
  );
}
