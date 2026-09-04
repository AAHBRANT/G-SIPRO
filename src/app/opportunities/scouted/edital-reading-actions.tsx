"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Dispara a leitura do edital para esta licitação.
 *
 * Existe porque o serviço de leitura (ZIP/RAR, catálogo, governança de IA)
 * ficou pronto e no ar sem nenhum jeito de acioná-lo — a rota da API existia,
 * mas nenhuma tela a chamava. Sem este botão, os quatro pré-requisitos que só
 * o edital responde (consórcio, CAT, visita, garantia) ficam pendentes para
 * sempre, em toda licitação, e a nota nunca sai de ~38% mesmo no melhor caso.
 *
 * ⚠️ Deliberadamente MANUAL, uma licitação de cada vez — não dispara sozinho
 * para a fila inteira. A leitura é uma chamada paga de IA; ler as ~450 da
 * varredura toda semana gastaria com licitação que a equipe nem cogita
 * disputar. Quem decide QUAL edital vale a pena ler é a mesma pessoa que já
 * está olhando o acervo e o prazo desta linha.
 */
export function EditalReadingActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<string>();

  function ler() {
    setMensagem(undefined);
    startTransition(async () => {
      const response = await fetch(`/api/scouting/scouted-tenders/${id}/edital`, { method: "POST" });
      const payload = await response.json().catch(() => ({ data: { status: "FAILED", reason: "resposta inválida" } }));
      const outcome = payload.data as { status: string; reason?: string; title?: string };

      switch (outcome.status) {
        case "READ":
        case "ALREADY_READ":
          router.refresh();
          return;
        case "NOT_CONFIGURED":
          setMensagem("Falta aprovar o caso de uso de IA para EDITAL na governança.");
          return;
        case "NO_FILE":
          setMensagem("O órgão não publicou arquivo legível para esta licitação.");
          return;
        case "FILE_TOO_LARGE":
          setMensagem(`"${outcome.title}" passa do teto de tamanho.`);
          return;
        case "NOTHING_EXTRACTED":
          setMensagem("A leitura não encontrou nenhuma exigência no documento.");
          return;
        case "NO_IDENTIFIER":
          setMensagem("Número de controle fora do padrão do PNCP.");
          return;
        case "FAILED":
          setMensagem(outcome.reason ?? "Falha não identificada na leitura.");
          return;
        default:
          setMensagem("Desfecho inesperado — tente novamente.");
      }
    });
  }

  return <div className="bx-acao-edital">
    <button className="bx-bt sim" disabled={pending} onClick={ler} type="button">
      {pending ? "Lendo…" : "Ler edital"}
    </button>
    {mensagem && <span className="bx-erro">{mensagem}</span>}
  </div>;
}
