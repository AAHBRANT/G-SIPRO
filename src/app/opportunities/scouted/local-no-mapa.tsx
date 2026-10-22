"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { MouseEvent } from "react";

import { gravarVista } from "./fila-no-mapa";

const FILA = "/opportunities/scouted";

/**
 * A cidade da linha vira atalho para o mapa: leva ao estado dela, com o mapa
 * aberto e os demais filtros preservados. Fora da fila (a janelinha da
 * Análise usa o mesmo cabeçalho) o atalho abre a fila já no estado.
 *
 * O clique não pode abrir a sanfona da linha — o texto mora dentro do
 * `<summary>` —, por isso o `preventDefault` e a navegação manual.
 */
export function LocalNoMapa({ texto, uf, simples }: { texto: string; uf: string | undefined; simples?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  if (!uf) return simples ? null : <p className="bx-local">{texto}</p>;

  const next = new URLSearchParams(pathname === FILA ? params.toString() : "");
  next.set("uf", uf);
  const destino = `${FILA}?${next.toString()}#mapa`;

  function abrir(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    event.stopPropagation();
    gravarVista("ambos");
    router.push(destino);
  }

  // `simples`: só o link, no estilo dos outros atalhos (rodapé do painel).
  if (simples) return <a className="bx-link" href={destino} onClick={abrir}>{texto}</a>;
  return <p className="bx-local"><a className="bx-local-link" href={destino} onClick={abrir} title="Ver no mapa">{texto}</a></p>;
}
