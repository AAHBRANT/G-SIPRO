"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Força a releitura de um edital já lido.
 *
 * Existe para o caso em que a leitura gravada saiu ruim por um bug do parser
 * já corrigido (ex.: cabeçalho/separador de tabela markdown virando "parcela")
 * — sem isto, a licitação ficaria com o texto ruim congelado no banco para
 * sempre, sem nenhum jeito de corrigir além de mexer direto no Postgres.
 *
 * Pede confirmação porque releitura substitui a linha inteira: zera a
 * conferência humana anterior (`reviewedAt`/`reviewedById`), do mesmo jeito
 * que qualquer releitura já fazia antes deste botão existir.
 */
export function RereadEditalAction({ id }: { id: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [pending, startTransition] = useTransition();

  function reler() {
    setErro(undefined);
    startTransition(async () => {
      const response = await fetch(`/api/scouting/scouted-tenders/${id}/edital`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      if (!response.ok) {
        setErro("Não foi possível reler o edital agora.");
        return;
      }
      setConfirmando(false);
      router.refresh();
    });
  }

  if (confirmando) {
    return <span className="bx-reler-confirma">
      <span>Reler apaga a conferência humana já feita. Tem certeza?</span>
      <button className="bx-link forte" disabled={pending} onClick={reler} type="button">
        {pending ? "Relendo…" : "Sim, reler"}
      </button>
      <button className="bx-link" disabled={pending} onClick={() => setConfirmando(false)} type="button">
        Cancelar
      </button>
      {erro && <span className="bx-erro">{erro}</span>}
    </span>;
  }

  return <button className="bx-link" onClick={() => setConfirmando(true)} type="button">
    <svg aria-hidden="true" className="h-3 w-3" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 1 2.6 6.4M3 21v-6h6"/></svg>
    Reler edital
  </button>;
}
