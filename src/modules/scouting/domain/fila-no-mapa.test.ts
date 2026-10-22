import { describe, expect, it } from "vitest";

import { agruparPorCidade, faixaDoPrazo, prazoDoGrupo, totaisPorUf, type PontoDaFila } from "@/modules/scouting/domain/fila-no-mapa";

function ponto(overrides: Partial<PontoDaFila> & { id: string }): PontoDaFila {
  return {
    subject: "Construção de creche",
    authorityName: "Prefeitura de Curitiba",
    cidade: "Curitiba",
    uf: "PR",
    valor: 10_000_000,
    sigiloso: false,
    dias: 20,
    score: 63,
    atendidos: 5,
    totalDeRequisitos: 8,
    x: 405.7,
    y: 515.3,
    ...overrides,
  };
}

describe("faixaDoPrazo", () => {
  it("usa o mesmo corte de 14 dias do cartão 'Prazo curto'", () => {
    expect(faixaDoPrazo(14)).toBe("curto");
    expect(faixaDoPrazo(15)).toBe("medio");
    expect(faixaDoPrazo(30)).toBe("medio");
    expect(faixaDoPrazo(31)).toBe("folgado");
    expect(faixaDoPrazo(undefined)).toBe("sem-data");
  });
});

describe("totaisPorUf", () => {
  it("conta quantidade e soma valor por estado", () => {
    const totais = totaisPorUf([ponto({ id: "a" }), ponto({ id: "b", valor: 5_000_000 }), ponto({ id: "c", uf: "SP", valor: 1 })]);
    expect(totais.get("PR")).toEqual({ quantidade: 2, valor: 15_000_000 });
    expect(totais.get("SP")).toEqual({ quantidade: 1, valor: 1 });
  });

  it("valor sigiloso conta na quantidade mas não soma no valor", () => {
    const totais = totaisPorUf([ponto({ id: "a" }), ponto({ id: "b", sigiloso: true, valor: undefined })]);
    expect(totais.get("PR")).toEqual({ quantidade: 2, valor: 10_000_000 });
  });

  it("licitação sem UF não pinta estado nenhum", () => {
    expect(totaisPorUf([ponto({ id: "a", uf: undefined })]).size).toBe(0);
  });
});

describe("agruparPorCidade", () => {
  it("licitações da mesma sede viram um ponto só", () => {
    const grupos = agruparPorCidade([ponto({ id: "a" }), ponto({ id: "b" }), ponto({ id: "c", x: 448.7, y: 484.3 })]);
    expect(grupos).toHaveLength(2);
    expect(grupos.find((g) => g.pontos.length === 2)?.pontos.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("município sem posição fica fora do desenho", () => {
    expect(agruparPorCidade([ponto({ id: "a", x: undefined, y: undefined })])).toHaveLength(0);
  });
});

describe("prazoDoGrupo", () => {
  it("o ponto da cidade fica com o prazo mais curto do grupo", () => {
    const [grupo] = agruparPorCidade([ponto({ id: "a", dias: 40 }), ponto({ id: "b", dias: 5 }), ponto({ id: "c", dias: undefined })]);
    expect(prazoDoGrupo(grupo!)).toBe(5);
  });

  it("sem nenhuma data no grupo, não inventa prazo", () => {
    const [grupo] = agruparPorCidade([ponto({ id: "a", dias: undefined })]);
    expect(prazoDoGrupo(grupo!)).toBeUndefined();
  });
});
