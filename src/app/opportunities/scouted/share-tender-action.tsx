"use client";

import { useState, useTransition } from "react";

export type ShareRecipient = Readonly<{ id: string; email: string; label: string }>;

/**
 * Link de chat do próprio Teams (não é chamada de API, é navegação pura) —
 * abre o Teams direto numa conversa 1:1 com a pessoa, com a licitação já como
 * rascunho da mensagem. Documentado pela Microsoft como "deep link to a
 * specific chat"; não precisa de nenhuma permissão nova no Graph porque quem
 * efetivamente manda a mensagem é a própria pessoa, clicando Enviar do lado
 * dela — o app só monta o link.
 */
function linkDaConversa(email: string, mensagem: string): string {
  const parametros = new URLSearchParams({ users: email, message: mensagem });
  return `https://teams.microsoft.com/l/chat/0/0?${parametros.toString()}`;
}

/**
 * Compartilha a licitação com alguém já cadastrado no G-SIPRO, pelo Teams
 * (e por e-mail, de reforço). A lista de destinatários vem pronta do
 * servidor — não existe endpoint de busca de usuário aqui, é a mesma lista
 * pequena de gente ativa na casa.
 */
export function ShareTenderAction({ id, subject, recipients }: { id: string; subject: string; recipients: readonly ShareRecipient[] }) {
  const [open, setOpen] = useState(false);
  const [recipientId, setRecipientId] = useState(recipients[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [resultado, setResultado] = useState<string>();
  const [erro, setErro] = useState<string>();
  const [pending, startTransition] = useTransition();
  const destinatario = recipients.find((recipient) => recipient.id === recipientId);

  function fechar() {
    setOpen(false);
    setNote("");
    setErro(undefined);
    setResultado(undefined);
  }

  function enviar() {
    setErro(undefined);
    setResultado(undefined);
    startTransition(async () => {
      const response = await fetch(`/api/scouting/scouted-tenders/${id}/share`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipientId, ...(note.trim() ? { note: note.trim() } : {}) }),
      });
      if (!response.ok) {
        setErro("Não foi possível compartilhar agora.");
        return;
      }
      const payload = await response.json().catch(() => ({ data: {} }));
      const teamsOk = payload.data?.teams === "ACCEPTED";
      const emailOk = payload.data?.email === "ACCEPTED";
      setResultado(
        teamsOk || emailOk
          ? `Enviado${teamsOk ? " pelo Teams" : ""}${teamsOk && emailOk ? " e" : ""}${emailOk ? " por e-mail" : ""}.`
          : "Não chegou nem pelo Teams nem por e-mail — confira se a pessoa tem o Teams do G-SIPRO instalado.",
      );
    });
  }

  if (!open) {
    return <button
      aria-label="Compartilhar licitação"
      className="bx-ic"
      onClick={(event) => { event.preventDefault(); setOpen(true); }}
      title="Compartilhar"
      type="button"
    >
      <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5 15.4 6.5M8.6 13.5 15.4 17.5"/></svg>
    </button>;
  }

  return <div className="bx-fundo" onClick={(event) => { if (event.target === event.currentTarget) fechar(); }}>
    <div aria-label="Compartilhar licitação" aria-modal="true" className="bx-modal" role="dialog">
      <div className="bx-modal-cab">
        <div>
          <h2>Compartilhar licitação</h2>
          <p>Manda o link direto pra esta licitação pelo Teams, pra alguém já cadastrado no G-SIPRO.</p>
        </div>
        <button aria-label="Fechar" className="fechar" onClick={fechar} type="button">×</button>
      </div>

      <div className="bx-modal-corpo">
        <label className="bx-rot" htmlFor={`share-dest-${id}`}>Destinatário</label>
        <select className="bx-sel" id={`share-dest-${id}`} onChange={(event) => setRecipientId(event.target.value)} value={recipientId}>
          {recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.label}</option>)}
        </select>

        <label className="bx-rot" htmlFor={`share-nota-${id}`} style={{ display: "block", marginTop: 13 }}>Recado (opcional)</label>
        <textarea
          className="bx-campo-g"
          id={`share-nota-${id}`}
          maxLength={400}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Ex.: dá uma olhada nessa, prazo curto"
          value={note}
        />
        {erro && <p className="bx-erro" style={{ marginTop: 8 }}>{erro}</p>}
        {resultado && <>
          <p className="bx-nota" style={{ marginTop: 8 }}>{resultado}</p>
          {destinatario && <a
            className="bx-link forte"
            href={linkDaConversa(
              destinatario.email,
              `${subject.slice(0, 200)}${note.trim() ? ` — ${note.trim()}` : ""} — ${typeof window !== "undefined" ? `${window.location.origin}/opportunities/scouted#${id}` : ""}`,
            )}
            rel="noreferrer"
            style={{ marginTop: 10 }}
            target="_blank"
          >
            Abrir conversa no Teams com {destinatario.label.split(" (")[0]}
          </a>}
        </>}
      </div>

      <div className="bx-modal-pe">
        <button className="bx-bt nao" onClick={fechar} type="button">{resultado ? "Fechar" : "Cancelar"}</button>
        {!resultado && <button className="bx-bt sim" disabled={pending || !recipientId} onClick={enviar} type="button">
          {pending ? "Enviando…" : "Compartilhar"}
        </button>}
      </div>
    </div>
  </div>;
}
