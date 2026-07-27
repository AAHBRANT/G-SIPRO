import { describe, expect, it } from "vitest";

import { attractivenessPointInputSchema } from "./attractiveness-point";

describe("attractivenessPointInputSchema", () => {
  it("exige valor para ponto quantitativo", () => {
    const result = attractivenessPointInputSchema.safeParse({
      category: "QUANTITATIVE",
      description: "Preço ofertado é maior que o de mercado.",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita valor em ponto qualitativo", () => {
    const result = attractivenessPointInputSchema.safeParse({
      category: "QUALITATIVE",
      description: "Ganho de acervo técnico para obras futuras.",
      amount: 1000,
    });
    expect(result.success).toBe(false);
  });

  it("aceita ponto quantitativo com valor", () => {
    const result = attractivenessPointInputSchema.safeParse({
      category: "QUANTITATIVE",
      description: "Diferença entre o preço ofertado e o custo real de execução.",
      amount: 2000,
    });
    expect(result.success).toBe(true);
  });

  it("aceita ponto qualitativo sem valor", () => {
    const result = attractivenessPointInputSchema.safeParse({
      category: "QUALITATIVE",
      description: "Terreno cedido gratuitamente para o canteiro de obras.",
    });
    expect(result.success).toBe(true);
  });
});
