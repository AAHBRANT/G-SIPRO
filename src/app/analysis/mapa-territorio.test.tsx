import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MapaTerritorio } from "@/app/analysis/mapa-territorio";
import { UNIDADES_FEDERATIVAS } from "@/modules/analysis/domain/malha-uf";
import type { CelulaTerritorial } from "@/modules/analysis/domain/territorio";

/**
 * Render do servidor: pega o estado inicial da tela, que é o que todo mundo
 * vê ao abrir. Cobre o que quebraria em silêncio — largura de barra inválida,
 * número desconhecido virando zero, aviso de escopo sumindo.
 */

const celula = (uf: string | null, esfera: string, aderentes: number, valor: number | null): CelulaTerritorial => ({
  mes: "2026-09-01",
  uf,
  esfera,
  quantidade: { aderentes, aprovadas: Math.floor(aderentes / 2), orcamento: Math.floor(aderentes / 4), propostas: Math.floor(aderentes / 8) },
  valor: {
    aderentes: valor,
    aprovadas: valor === null ? null : valor / 2,
    orcamento: valor === null ? null : valor / 4,
    propostas: valor === null ? null : valor / 8,
  },
  semValor: valor === null ? aderentes : 0,
});

const MESES = new Set(["2026-09-01"]);

const BASE: readonly CelulaTerritorial[] = [
  celula("MG", "M", 64, 42_000_000),
  celula("SP", "M", 31, 28_000_000),
  celula("BA", "M", 18, 9_500_000),
  celula("RS", "E", 7, 3_100_000),
  celula("DF", "D", 4, 2_200_000),
  celula("PA", "F", 3, null),
];

const render = (celulas: readonly CelulaTerritorial[] = BASE, medida: "qtd" | "val" = "qtd") =>
  renderToStaticMarkup(<MapaTerritorio celulas={celulas} medida={medida} meses={MESES}/>);

describe("mapa do território", () => {
  const html = render();

  it("desenha as 27 unidades da federação", () => {
    const contornos = html.match(/class="an-uf /g) ?? [];
    expect(contornos).toHaveLength(UNIDADES_FEDERATIVAS.length);
  });

  /**
   * Largura inválida é descartada pelo navegador e a barra aparece CHEIA:
   * "não sei" ficaria idêntico a "o máximo possível".
   */
  it("nenhuma largura inválida escapa para o HTML", () => {
    expect(html).not.toMatch(/width:\s*(NaN|Infinity|-)/);
  });

  it("não imprime NaN em lugar nenhum", () => {
    const semComentarios = html.replace(/<!--[\s\S]*?-->/g, "");
    expect(semComentarios).not.toContain("NaN");
    expect(semComentarios).not.toContain("Infinity");
  });

  /** Sem este aviso, quem filtra "Sul" e vê o card nacional igual acha que quebrou. */
  it("avisa que os filtros daqui não mexem nos cards do topo", () => {
    expect(html).toContain("os cards do topo continuam nacionais");
  });

  /** Afirmar que é o local da obra seria dizer o que o dado não sustenta. */
  it("diz que a localização é a sede do órgão", () => {
    expect(html).toContain("sede do órgão que publicou");
  });

  /** Dentro da lista, não no HTML inteiro: o select de estados vem antes e é alfabético. */
  it("o líder do ranking aparece em primeiro", () => {
    const lista = html.slice(html.indexOf("<ol"), html.indexOf("</ol>"));
    const posicao = (sigla: string) => lista.indexOf(`${sigla} ·`);
    expect(posicao("MG")).toBeGreaterThan(-1);
    expect(posicao("MG")).toBeLessThan(posicao("SP"));
    expect(posicao("SP")).toBeLessThan(posicao("BA"));
  });

  it("o estado com mais licitações recebe o tom mais escuro", () => {
    expect(html).toMatch(/class="an-uf n5"[^>]*>\s*<title>Minas Gerais/);
  });

  it("estado sem licitação fica no nível vazio, não indisponível", () => {
    expect(html).toMatch(/class="an-uf n0"[^>]*>\s*<title>Acre: sem ocorrência/);
  });

  it("as quatro esferas aparecem como filtro", () => {
    for (const rotulo of ["Federal", "Estadual", "Municipal", "Distrital"]) expect(html).toContain(rotulo);
  });

  it("a escala do mapa é explicada na legenda", () => {
    expect(html).toContain("escala pelo maior estado do país");
  });
});

describe("medida em reais", () => {
  const html = render(BASE, "val");

  /**
   * Orçamento sigiloso é o caso real: o Pará tem licitação e não tem valor.
   * Em reais ele não pode virar "R$ 0" nem sumir do aviso.
   */
  it("estado com licitação e sem valor fica indisponível, com hachura", () => {
    expect(html).toMatch(/class="an-uf nx"[^>]*>\s*<title>Pará/);
    expect(html).toContain("an-hachura");
  });

  it("conta as licitações que ficaram fora da soma em reais", () => {
    expect(html).toContain("não informaram valor estimado");
  });
});

describe("casos que não podem quebrar a tela", () => {
  it("período sem licitação nenhuma mostra recado, não tela vazia", () => {
    const html = render([]);
    expect(html).toContain("Nenhuma licitação neste recorte de período");
    expect(html).not.toContain("NaN");
  });

  it("licitação sem estado informado é dita, não escondida", () => {
    const html = render([...BASE, celula(null, "M", 5, 1_000_000)]);
    expect(html).toContain("sem estado informado no portal");
  });

  it("uma única licitação não produz escala inválida", () => {
    const html = render([celula("RR", "M", 1, 1)]);
    expect(html).not.toContain("NaN");
    expect(html).toMatch(/class="an-uf n5"[^>]*>\s*<title>Roraima/);
  });
});
