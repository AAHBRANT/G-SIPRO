"use client";

import { useState } from "react";

/**
 * Baixa, num arquivo só, todos os documentos que o órgão publicou no PNCP.
 *
 * ⚠️ Tem de ser `fetch` daqui de dentro, NUNCA um `<a href>` para a rota. O
 * G-SIPRO roda dentro do Teams, e a sessão criada ali não acompanha uma
 * navegação de topo: tanto o atributo `download` quanto `target="_blank"`
 * levaram a mesma tela de `AUTHENTICATION_REQUIRED` em 21/09/2026 — a primeira
 * salvando o erro como "documentos.json", a segunda abrindo o json cru numa
 * aba do navegador. Requisição feita a partir do próprio app viaja com o
 * cookie, que é como aprovar e descartar sempre funcionaram.
 *
 * ⚠️ Este botão NÃO dispara leitura de edital — ele só busca arquivos que já
 * estão publicados no portal. A regra de nunca existir botão que manda ler
 * edital continua valendo (ver o comentário na rota do edital).
 */
export function BaixarDocumentos({ id }: { id: string }) {
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string>();

  async function baixar() {
    setErro(undefined);
    setBaixando(true);
    try {
      const resposta = await fetch(`/api/scouting/scouted-tenders/${id}/documentos`);
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null) as { error?: { message?: string } } | null;
        setErro(corpo?.error?.message ?? "Não foi possível montar o pacote agora. Tente pelo link do PNCP.");
        return;
      }
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nomeDoArquivo(resposta.headers.get("content-disposition"));
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Pacote grande com rede instável cai aqui. Dizer "tente de novo" sem
      // dizer o que houve faz a pessoa repetir o download de 20 MB às cegas.
      setErro("A conexão caiu enquanto o pacote era montado. Se a licitação tiver muitos projetos, baixe pelo PNCP.");
    } finally {
      setBaixando(false);
    }
  }

  return <>
    <button className="bx-link forte" disabled={baixando} onClick={baixar} type="button">
      <svg aria-hidden="true" className="h-3 w-3" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 20h16"/></svg>
      {baixando ? "Montando o pacote…" : "Baixar edital e anexos"}
    </button>
    {erro && <p className="bx-erro" role="alert">{erro}</p>}
  </>;
}

/** O nome verdadeiro vem do cabeçalho; sem ele, um nome genérico serve. */
function nomeDoArquivo(disposition: string | null): string {
  const achado = disposition ? /filename="([^"]+)"/.exec(disposition) : null;
  return achado?.[1] ?? "documentos-da-licitacao.zip";
}
