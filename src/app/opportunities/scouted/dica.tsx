"use client";

import { useId, useRef, useState } from "react";

/** Largura máxima do balão em `scouted.css` — metade dela é a margem até a borda da tela. */
const META_LARGURA = 130;

/**
 * Ícone "i" que explica um rótulo ao passar o mouse, tocar ou focar pelo
 * teclado. O balão fica fixo na tela (position: fixed) porque a grade de
 * fatos corta o que transborda — `overflow: hidden`, por causa dos cantos
 * arredondados — e um balão dentro dela sumiria pela metade.
 *
 * O texto fica sempre no HTML (só oculto) para que `aria-describedby` funcione
 * em leitor de tela mesmo sem o balão aberto.
 */
export function Dica({ rotulo, texto }: { rotulo: string; texto: string }) {
  const id = useId();
  const botao = useRef<HTMLButtonElement>(null);
  const [posicao, setPosicao] = useState<{ top: number; left: number } | null>(null);

  const abrir = () => {
    const caixa = botao.current?.getBoundingClientRect();
    if (!caixa) return;
    const centro = caixa.left + caixa.width / 2;
    const left = Math.min(Math.max(centro, META_LARGURA + 8), window.innerWidth - META_LARGURA - 8);
    setPosicao({ top: caixa.bottom + 6, left });
  };
  const fechar = () => setPosicao(null);

  return (
    <>
      <button
        aria-describedby={id}
        aria-label={`O que é ${rotulo}?`}
        className="bx-dica"
        onBlur={fechar}
        onClick={(event) => { event.stopPropagation(); abrir(); }}
        onFocus={abrir}
        onKeyDown={(event) => { if (event.key === "Escape") fechar(); }}
        onMouseEnter={abrir}
        onMouseLeave={fechar}
        ref={botao}
        type="button"
      >
        <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
      </button>
      <span className="bx-dica-balao" data-aberta={posicao ? "" : undefined} id={id} role="tooltip" style={posicao ?? undefined}>{texto}</span>
    </>
  );
}
