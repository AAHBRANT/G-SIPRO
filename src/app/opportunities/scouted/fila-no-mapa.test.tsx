import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext, SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";

import { FilaNoMapa } from "@/app/opportunities/scouted/fila-no-mapa";
import { projetar } from "@/modules/analysis/domain/territorio";
import { acharMunicipio } from "@/modules/analysis/infrastructure/municipios-brasil";
import type { PontoDaFila } from "@/modules/scouting/domain/fila-no-mapa";

/**
 * Render do servidor, como a tela abre: a vista padrão (lista + mapa), sem
 * clique nenhum. A navegação do Next é trocada por uma que não navega — o
 * componente só precisa que ela exista para desenhar.
 */
const roteador: AppRouterInstance = {
  back: () => {}, forward: () => {}, refresh: () => {}, push: () => {}, replace: () => {}, prefetch: () => {},
} as unknown as AppRouterInstance;

function comNavegacao(conteudo: ReactNode, busca = "") {
  return <AppRouterContext.Provider value={roteador}>
    <PathnameContext.Provider value="/opportunities/scouted">
      <SearchParamsContext.Provider value={new URLSearchParams(busca) as never}>{conteudo}</SearchParamsContext.Provider>
    </PathnameContext.Provider>
  </AppRouterContext.Provider>;
}

function ponto(id: string, cidade: string, uf: string, dias: number, valor = 10_000_000): PontoDaFila {
  const municipio = acharMunicipio(cidade, uf)!;
  const { x, y } = projetar(municipio.latitude, municipio.longitude);
  return { id, subject: `Obra ${id}`, authorityName: `Prefeitura de ${cidade}`, cidade, uf, valor, sigiloso: false, dias, encerramento: "2026-11-05T21:00:00.000Z", score: 63, atendidos: 5, totalDeRequisitos: 8, x, y };
}

const PONTOS = [
  ponto("a", "Curitiba", "PR", 40),
  ponto("b", "Curitiba", "PR", 5),
  ponto("c", "Londrina", "PR", 20),
  ponto("d", "Vitória", "ES", 45, 121_900_000),
];

function render(uf?: string) {
  return renderToStaticMarkup(comNavegacao(
    <FilaNoMapa canDecide pontos={PONTOS} resumo={<p>resumo</p>} titulo={<h2>Relação de rastreadas</h2>} uf={uf}>
      <div id="lista-do-servidor">linhas</div>
    </FilaNoMapa>,
    uf ? `uf=${uf}` : "",
  ));
}

describe("FilaNoMapa", () => {
  it("abre em Lista + mapa: seletor, mapa com os 27 estados e a lista do servidor", () => {
    const html = render();
    expect(html).toMatch(/aria-pressed="true" type="button"><svg[^]*?<\/svg>Lista \+ mapa<\/button>/);
    expect(html.match(/class="bx-mapa-uf /g)).toHaveLength(27);
    expect(html).toContain('id="lista-do-servidor"');
  });

  it("junta as licitações da mesma cidade num ponto com o número, colorido pelo prazo mais curto", () => {
    const html = render();
    expect(html.match(/class="bx-mapa-ponto /g)).toHaveLength(3);
    expect(html).toMatch(/class="bx-mapa-ponto curto"[^>]*>.*?>2<\/text>/s);
  });

  it("pinta o estado com mais licitações no tom mais escuro", () => {
    const html = render();
    expect(html).toMatch(/class="bx-mapa-uf n5"[^>]*><title>Paraná: 3 na fila/);
    expect(html).toMatch(/class="bx-mapa-uf n2"[^>]*><title>Espírito Santo: 1 na fila/);
  });

  it("no estado escolhido, apaga os outros e mostra só o recorte no painel", () => {
    const html = render("PR");
    expect(html).toMatch(/<title>Paraná: 3 na fila/);
    expect(html).toMatch(/class="bx-mapa-uf n2 apagado"[^>]*><title>Espírito Santo/);
    expect(html).toContain('<p class="bx-mapa-nome">Paraná</p><p class="bx-mapa-grande">3</p>');
    expect(html.match(/class="bx-mapa-ponto /g)).toHaveLength(2);
  });

  it("sem estado escolhido, o painel traz o ranking dos estados", () => {
    const html = render();
    expect(html).toContain("Estados com mais licitações");
    expect(html).toMatch(/PR · Paraná<\/span><span class="val">3</);
  });
});
