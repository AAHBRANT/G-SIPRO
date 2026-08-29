import { describe, expect, it } from "vitest";

import { compareQuantity, convert, normalizeUnit, parseQuantity } from "@/modules/scouting/domain/quantity";

describe("normalizeUnit", () => {
  it.each([
    ["m", "m"], ["M", "m"], ["ml", "m"], ["metro linear", "m"], ["metros", "m"],
    ["km", "km"], ["KM", "km"], ["quilômetro", "km"],
    ["m²", "m2"], ["M2", "m2"], ["metro quadrado", "m2"],
    ["m³", "m3"], ["m3", "m3"], ["metros cúbicos", "m3"],
    ["ha", "ha"], ["hectares", "ha"],
    ["t", "t"], ["ton", "t"], ["toneladas", "t"], ["kg", "kg"],
    ["un", "un"], ["unid.", "un"], ["unidades", "un"], ["peça", "un"],
  ])("%s → %s", (escrito, esperado) => {
    expect(normalizeUnit(escrito)).toBe(esperado);
  });

  /**
   * Unidade que não se compara por número é resposta legítima, não falha.
   * Verba e ponto não têm quantitativo comparável, e forçar comparação aqui
   * produziria "atende" sem base nenhuma.
   */
  it.each(["verba", "vb", "conjunto", "serviço", "ponto", "", undefined])("não reconhece %s", (escrito) => {
    expect(normalizeUnit(escrito)).toBeNull();
  });
});

describe("parseQuantity", () => {
  /**
   * Formato brasileiro: ponto é milhar, vírgula é decimal. Ler ao contrário
   * transformaria 1.500 m em 1,5 m — erro de mil vezes bem no número que
   * decide habilitação.
   */
  it("lê milhar com ponto e decimal com vírgula", () => {
    expect(parseQuantity("1.234,56 m²")).toEqual({ value: 1234.56, unit: "m2" });
    expect(parseQuantity("12.000 m")).toEqual({ value: 12000, unit: "m" });
  });

  it("lê sem espaço entre número e unidade", () => {
    expect(parseQuantity("3500m3")).toEqual({ value: 3500, unit: "m3" });
  });

  it("lê unidade por extenso", () => {
    expect(parseQuantity("8 quilômetros")).toEqual({ value: 8, unit: "km" });
  });

  it("devolve nulo quando não há unidade comparável", () => {
    expect(parseQuantity("1 verba")).toBeNull();
    expect(parseQuantity("120")).toBeNull();
  });

  it("devolve nulo para quantidade ausente, zero ou negativa", () => {
    for (const texto of [undefined, "", "0 m", "-5 m", "sem informação"]) {
      expect(parseQuantity(texto)).toBeNull();
    }
  });
});

describe("convert", () => {
  it("converte dentro da mesma dimensão", () => {
    expect(convert({ value: 8, unit: "km" }, "m")).toBe(8000);
    expect(convert({ value: 2, unit: "ha" }, "m2")).toBe(20_000);
    expect(convert({ value: 1.5, unit: "t" }, "kg")).toBe(1500);
  });

  /**
   * Metro linear não vira metro quadrado sem saber a largura. Chutar aqui
   * produziria "atende" onde a comissão diria o contrário — com a proposta já
   * paga.
   */
  it("recusa converter entre dimensões diferentes", () => {
    expect(convert({ value: 100, unit: "m" }, "m2")).toBeNull();
    expect(convert({ value: 10, unit: "un" }, "m")).toBeNull();
    expect(convert({ value: 5, unit: "m3" }, "kg")).toBeNull();
  });
});

describe("compareQuantity", () => {
  /** O caso que motivou este módulo. */
  it("ponte de 30 m cobre exigência de 15 m", () => {
    const c = compareQuantity({ value: 15, unit: "m" }, [{ value: 30, unit: "m" }]);
    expect(c.verdict).toBe("COVERED");
    expect(c.best).toBe(30);
    expect(c.explanation).toContain("cobre");
  });

  it("cobre também quando o acervo está em outra unidade da mesma dimensão", () => {
    // 8 km executados contra 3.000 m exigidos.
    const c = compareQuantity({ value: 3000, unit: "m" }, [{ value: 8, unit: "km" }]);
    expect(c.verdict).toBe("COVERED");
    expect(c.best).toBe(8000);
  });

  it("usa o MAIOR atestado, não o primeiro", () => {
    const c = compareQuantity({ value: 15, unit: "m" }, [
      { value: 8, unit: "m" }, { value: 30, unit: "m" }, { value: 12, unit: "m" },
    ]);
    expect(c.verdict).toBe("COVERED");
    expect(c.best).toBe(30);
  });

  /**
   * Nem todo edital aceita somatório de atestados. Afirmar cobertura com base
   * numa soma que a comissão pode recusar é o erro caro — a soma vai informada,
   * e quem lê o edital decide.
   */
  it("não afirma cobertura pela soma, mas informa a soma", () => {
    const c = compareQuantity({ value: 40, unit: "m" }, [
      { value: 20, unit: "m" }, { value: 25, unit: "m" },
    ]);
    expect(c.verdict).toBe("BELOW");
    expect(c.best).toBe(25);
    expect(c.total).toBe(45);
    expect(c.explanation).toContain("se o edital aceitar somatório");
  });

  it("quando nem a soma alcança, diz os dois números", () => {
    const c = compareQuantity({ value: 100, unit: "m" }, [{ value: 20, unit: "m" }, { value: 25, unit: "m" }]);
    expect(c.verdict).toBe("BELOW");
    expect(c.explanation).toContain("soma de todos");
  });

  it("declara incomparável quando o acervo está em outra dimensão", () => {
    const c = compareQuantity({ value: 500, unit: "m2" }, [{ value: 100, unit: "m" }]);
    expect(c.verdict).toBe("INCOMPARABLE");
    expect(c.ignored).toBe(1);
    expect(c.best).toBeUndefined();
  });

  it("declara incomparável quando o acervo não tem quantitativo", () => {
    const c = compareQuantity({ value: 500, unit: "m2" }, []);
    expect(c.verdict).toBe("INCOMPARABLE");
    expect(c.explanation).toContain("sem quantitativo no acervo");
  });

  it("compara o que dá e conta o que ficou de fora", () => {
    const c = compareQuantity({ value: 15, unit: "m" }, [
      { value: 30, unit: "m" }, { value: 200, unit: "m2" }, null,
    ]);
    expect(c.verdict).toBe("COVERED");
    expect(c.comparable).toBe(1);
    expect(c.ignored).toBe(2);
  });

  it("empate no quantitativo exigido conta como coberto", () => {
    // O edital pede o mínimo; alcançar o mínimo atende.
    expect(compareQuantity({ value: 15, unit: "m" }, [{ value: 15, unit: "m" }]).verdict).toBe("COVERED");
  });
});
