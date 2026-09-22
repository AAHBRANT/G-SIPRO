import { describe, expect, it } from "vitest";

import { UNIDADES_FEDERATIVAS, ufPorSigla } from "@/modules/analysis/domain/malha-uf";
import {
  CAIXA_DO_BRASIL,
  filtrar,
  total,
  ZOOM_MAXIMO,
  ZOOM_MINIMO,
  caixaBase,
  caixaComZoom,
  limitarZoom,
  rotulosSemColisao,
  unidadeNaTela,
  viewBoxDe,
} from "@/modules/analysis/domain/territorio";

describe("caixa de cada estado", () => {
  /** A caixa é o que amplia o estado; errada, o zoom cai no lugar errado. */
  it("envolve todos os pontos do contorno", () => {
    for (const uf of UNIDADES_FEDERATIVAS) {
      const pontos = [...uf.contorno.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
      expect(pontos.length).toBeGreaterThan(2);
      for (const [x, y] of pontos) {
        expect(x).toBeGreaterThanOrEqual(uf.caixa.x - 0.1);
        expect(y).toBeGreaterThanOrEqual(uf.caixa.y - 0.1);
        expect(x).toBeLessThanOrEqual(uf.caixa.x + uf.caixa.largura + 0.1);
        expect(y).toBeLessThanOrEqual(uf.caixa.y + uf.caixa.altura + 0.1);
      }
    }
  });

  it("toda caixa cabe dentro do mapa do Brasil", () => {
    for (const uf of UNIDADES_FEDERATIVAS) {
      expect(uf.caixa.x).toBeGreaterThanOrEqual(-1);
      expect(uf.caixa.x + uf.caixa.largura).toBeLessThanOrEqual(CAIXA_DO_BRASIL.largura + 1);
      expect(uf.caixa.altura).toBeGreaterThan(0);
    }
  });
});

describe("entrar no estado", () => {
  it("sem estado, a base é o país inteiro", () => {
    expect(caixaBase(null)).toEqual(CAIXA_DO_BRASIL);
    expect(caixaBase(undefined)).toEqual(CAIXA_DO_BRASIL);
  });

  it("com estado, a base é o estado com folga em volta", () => {
    const mg = ufPorSigla("MG");
    const base = caixaBase(mg);
    expect(base.largura).toBeGreaterThan(mg!.caixa.largura);
    expect(base.x).toBeLessThan(mg!.caixa.x);
    // e ainda é MUITO menor que o país — senão não é zoom nenhum
    expect(base.largura).toBeLessThan(CAIXA_DO_BRASIL.largura / 2);
  });

  it("o estado inteiro cabe na caixa ampliada", () => {
    for (const uf of UNIDADES_FEDERATIVAS) {
      const base = caixaBase(uf);
      expect(base.x).toBeLessThanOrEqual(uf.caixa.x);
      expect(base.y).toBeLessThanOrEqual(uf.caixa.y);
      expect(base.x + base.largura).toBeGreaterThanOrEqual(uf.caixa.x + uf.caixa.largura);
      expect(base.y + base.altura).toBeGreaterThanOrEqual(uf.caixa.y + uf.caixa.altura);
    }
  });
});

describe("zoom manual", () => {
  it("respeita os limites e nunca aceita lixo", () => {
    expect(limitarZoom(0.2)).toBe(ZOOM_MINIMO);
    expect(limitarZoom(999)).toBe(ZOOM_MAXIMO);
    expect(limitarZoom(Number.NaN)).toBe(ZOOM_MINIMO);
    expect(limitarZoom(Number.POSITIVE_INFINITY)).toBe(ZOOM_MAXIMO);
  });

  it("dobrar o zoom corta a caixa pela metade", () => {
    const caixa = caixaComZoom(CAIXA_DO_BRASIL, 2, null);
    expect(caixa.largura).toBe(365);
    expect(caixa.altura).toBe(340);
  });

  it("sem zoom, a caixa é a base", () => {
    expect(caixaComZoom(CAIXA_DO_BRASIL, 1, null)).toEqual(CAIXA_DO_BRASIL);
  });

  /** Arrastar para fora e não achar o caminho de volta é o pior defeito de um mapa. */
  it("arrastar não leva o mapa para fora da base", () => {
    const longe = caixaComZoom(CAIXA_DO_BRASIL, 4, { x: -5000, y: 9999 });
    expect(longe.x).toBeGreaterThanOrEqual(CAIXA_DO_BRASIL.x);
    expect(longe.y).toBeGreaterThanOrEqual(CAIXA_DO_BRASIL.y);
    expect(longe.x + longe.largura).toBeLessThanOrEqual(CAIXA_DO_BRASIL.largura + 0.001);
    expect(longe.y + longe.altura).toBeLessThanOrEqual(CAIXA_DO_BRASIL.altura + 0.001);
  });

  it("centro inválido não produz viewBox quebrado", () => {
    const caixa = caixaComZoom(CAIXA_DO_BRASIL, 2, { x: Number.NaN, y: 10 });
    expect(Number.isFinite(caixa.x)).toBe(true);
    expect(viewBoxDe(caixa)).not.toContain("NaN");
  });

  it("o viewBox sai no formato que o SVG espera", () => {
    expect(viewBoxDe(CAIXA_DO_BRASIL)).toBe("0.0 0.0 730.0 680.0");
  });
});

describe("tamanho aparente dos pontos e rótulos", () => {
  /** Sem compensar, ampliar vira bolha gigante e nome cobrindo o mapa. */
  it("encolhe na mesma proporção em que o mapa amplia", () => {
    expect(unidadeNaTela(CAIXA_DO_BRASIL)).toBe(1);
    expect(unidadeNaTela(caixaComZoom(CAIXA_DO_BRASIL, 2, null))).toBeCloseTo(0.5, 5);
    expect(unidadeNaTela(caixaBase(ufPorSigla("MG")))).toBeLessThan(0.4);
  });

  it("caixa inválida não vira escala inválida", () => {
    expect(unidadeNaTela({ x: 0, y: 0, largura: 0, altura: 0 })).toBe(1);
    expect(unidadeNaTela({ x: 0, y: 0, largura: Number.NaN, altura: 10 })).toBe(1);
  });
});

describe("o recorte e o texto que o descreve precisam concordar", () => {
  const celula = (uf: string, cidade: string, n: number) => ({
    mes: "2026-09-01",
    uf,
    cidade,
    esfera: "M",
    quantidade: { aderentes: n, aprovadas: 0, orcamento: 0, propostas: 0 },
    valor: { aderentes: null, aprovadas: null, orcamento: null, propostas: null },
    semValor: 0,
  });
  const celulas = [celula("MG", "Belo Horizonte", 10), celula("SP", "São Paulo", 7), celula("RS", "Porto Alegre", 3)];

  /**
   * Achado durante o teste do zoom: a tela escrevia "Recorte: MG" e mostrava
   * o número do Brasil inteiro, porque o filtro de estado não entrava na
   * conta. Texto e número discordando é pior que os dois errados.
   */
  it("filtrar por estado muda o total", () => {
    expect(total(filtrar(celulas, { uf: "MG" }), "aderentes").quantidade).toBe(10);
    expect(total(filtrar(celulas, {}), "aderentes").quantidade).toBe(20);
  });

  it("o filtro de estado combina com o de região", () => {
    expect(total(filtrar(celulas, { regiao: "Sudeste", uf: "SP" }), "aderentes").quantidade).toBe(7);
    expect(total(filtrar(celulas, { regiao: "Sul", uf: "SP" }), "aderentes").quantidade).toBe(0);
  });
});

describe("rótulos dos municípios no mapa", () => {
  const ponto = (chave: string, nome: string, x: number, y: number) => ({ chave, nome, x, y });

  /** Belo Horizonte, Contagem e Betim ficam a poucos pixels uma da outra. */
  it("cidades coladas não empilham nome: a primeira da lista ganha", () => {
    const aceitos = rotulosSemColisao(
      [ponto("bh", "Belo Horizonte", 100, 100), ponto("contagem", "Contagem", 104, 102), ponto("betim", "Betim", 108, 103)],
      1,
    );
    expect(aceitos.has("bh")).toBe(true);
    expect(aceitos.has("contagem")).toBe(false);
    expect(aceitos.has("betim")).toBe(false);
  });

  it("cidades distantes ganham nome todas", () => {
    const aceitos = rotulosSemColisao([ponto("a", "Manaus", 100, 100), ponto("b", "Recife", 500, 400)], 1);
    expect(aceitos.size).toBe(2);
  });

  /** O selecionado é resposta a uma ação: não pode perder o nome para o vizinho. */
  it("o município escolhido sempre fica com o nome", () => {
    const aceitos = rotulosSemColisao(
      [ponto("bh", "Belo Horizonte", 100, 100), ponto("contagem", "Contagem", 104, 102)],
      1,
      "contagem",
    );
    expect(aceitos.has("contagem")).toBe(true);
    expect(aceitos.has("bh")).toBe(false);
  });

  /** Ampliar precisa fazer caber mais nome — é o que se espera de um zoom. */
  it("com o mapa ampliado cabem mais nomes no mesmo espaço", () => {
    const pontos = [ponto("a", "Belo Horizonte", 100, 100), ponto("b", "Contagem", 130, 100)];
    expect(rotulosSemColisao(pontos, 1).size).toBe(1);
    expect(rotulosSemColisao(pontos, 0.2).size).toBe(2);
  });

  it("escala inválida não quebra o cálculo", () => {
    expect(rotulosSemColisao([ponto("a", "X", 0, 0)], Number.NaN).size).toBe(1);
    expect(rotulosSemColisao([], 1).size).toBe(0);
  });
});
