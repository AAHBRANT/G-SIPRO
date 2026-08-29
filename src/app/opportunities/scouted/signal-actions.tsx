"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { suggestedColors, type SignalLevel } from "@/modules/scouting/domain/signal";

export type CurrentSignal = Readonly<{ level: SignalLevel; label: string; color: string; note?: string }>;

const níveisFixos: ReadonlyArray<{ value: Exclude<SignalLevel, "CUSTOM">; label: string }> = [
  { value: "HIGH", label: "Alta" },
  { value: "MEDIUM", label: "Média" },
  { value: "LOW", label: "Baixa" },
];

/** Bandeira fincada: mastro, pano e a sombra no chão. */
export function Flag({ size = 30 }: { size?: number }) {
  return (
    <svg aria-hidden="true" height={size} style={{ overflow: "visible" }} viewBox="0 0 24 30" width={Math.round(24 * (size / 30))}>
      <ellipse className="chao" cx="5.5" cy="28.4" rx="5" ry="1.6" />
      <path className="mastro" d="M5.5 29V2" fill="none" strokeLinecap="round" strokeWidth="2.2" />
      <path className="pano" d="M6.8 3h13.4l-3 4.3 3 4.3H6.8z" />
    </svg>
  );
}

/**
 * Botão e caixa de sinalização de uma licitação da fila.
 *
 * A marca é uma por licitação e vale para toda a equipe, então quem já
 * encontrar uma sinalização vê o estado atual carregado e pode trocá-lo.
 */
export function SignalActions({ id, signal }: { id: string; signal?: CurrentSignal }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<SignalLevel | undefined>(signal?.level);
  const [label, setLabel] = useState(signal?.level === "CUSTOM" ? signal.label : "");
  const [color, setColor] = useState(signal?.level === "CUSTOM" ? signal.color : suggestedColors[0]);
  const [note, setNote] = useState(signal?.note ?? "");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function fechar() {
    setOpen(false);
    setError(undefined);
  }

  function enviar(metodo: "POST" | "DELETE") {
    setError(undefined);
    startTransition(async () => {
      const corpo = level === "CUSTOM"
        ? { level, label: label.trim(), color, ...(note.trim() ? { note: note.trim() } : {}) }
        : { level, ...(note.trim() ? { note: note.trim() } : {}) };
      const response = await fetch(`/api/scouting/scouted-tenders/${id}/signal`, {
        method: metodo,
        headers: { "content-type": "application/json" },
        ...(metodo === "POST" ? { body: JSON.stringify(corpo) } : {}),
      });
      if (!response.ok) {
        setError(response.status === 409 ? "Esta licitação já saiu da fila." : "Não foi possível salvar a sinalização.");
        return;
      }
      fechar();
      router.refresh();
    });
  }

  const travado = level === undefined || (level === "CUSTOM" && label.trim().length < 2) || pending;

  return <>
    <button
      aria-label={signal ? `Sinalizada: ${signal.label}. Clique para alterar.` : "Sinalizar licitação"}
      className="bx-ic"
      data-on={signal ? "sim" : "nao"}
      onClick={(event) => { event.preventDefault(); setOpen(true); }}
      title={signal ? `Sinalizada: ${signal.label}` : "Sinalizar com prioridade"}
      type="button"
    >
      <Flag size={15}/>
    </button>

    {open && <div className="bx-fundo" onClick={(event) => { if (event.target === event.currentTarget) fechar(); }}>
      <div aria-label="Sinalizar licitação" aria-modal="true" className="bx-modal" role="dialog">
        <div className="bx-modal-cab">
          <div>
            <h2>Sinalizar licitação</h2>
            <p>A bandeira e a cor aparecem na fila para toda a equipe que abrir esta licitação.</p>
          </div>
          <button aria-label="Fechar" className="fechar" onClick={fechar} type="button">×</button>
        </div>

        <div className="bx-modal-corpo">
          <span className="bx-rot">Prioridade</span>
          <div className="bx-op-p" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            {níveisFixos.map((nível) => <button
              aria-pressed={level === nível.value}
              key={nível.value}
              onClick={() => setLevel(nível.value)}
              type="button"
            >{nível.label}</button>)}
            <button aria-pressed={level === "CUSTOM"} onClick={() => setLevel("CUSTOM")} type="button">Outro nome…</button>
          </div>

          {level === "CUSTOM" && <div className="bx-livre">
            <label className="bx-rot" htmlFor={`sinal-nome-${id}`}>Nome da sinalização</label>
            <input
              className="bx-campo"
              id={`sinal-nome-${id}`}
              maxLength={34}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ex.: aguardando acervo do Wellington"
              value={label}
            />
            <span className="bx-rot" style={{ display: "block", marginTop: 11 }}>Cor</span>
            <div className="bx-cores">
              {suggestedColors.map((sugerida) => <button
                aria-label={`Cor ${sugerida}`}
                aria-pressed={sugerida.toLowerCase() === color.toLowerCase()}
                className="bx-cor"
                key={sugerida}
                onClick={() => setColor(sugerida)}
                style={{ background: sugerida }}
                type="button"
              />)}
              <label className="bx-cor-livre" title="Outra cor">
                <input
                  aria-label="Escolher outra cor"
                  onChange={(event) => setColor(event.target.value)}
                  type="color"
                  value={color}
                />
              </label>
            </div>
          </div>}

          <label className="bx-rot" htmlFor={`sinal-obs-${id}`} style={{ display: "block", marginTop: 13 }}>Observação (opcional)</label>
          <textarea
            className="bx-campo-g"
            id={`sinal-obs-${id}`}
            maxLength={400}
            onChange={(event) => setNote(event.target.value)}
            placeholder="O que motivou a sinalização?"
            value={note}
          />
          {error && <p className="bx-erro" style={{ marginTop: 8 }}>{error}</p>}
        </div>

        <div className="bx-modal-pe">
          {signal && <button className="bx-bt nao" disabled={pending} onClick={() => enviar("DELETE")} style={{ marginRight: "auto" }} type="button">
            Remover sinalização
          </button>}
          <button className="bx-bt nao" onClick={fechar} type="button">Cancelar</button>
          <button className="bx-bt sim" disabled={travado} onClick={() => enviar("POST")} type="button">
            {pending ? "…" : "Sinalizar"}
          </button>
        </div>
      </div>
    </div>}
  </>;
}
