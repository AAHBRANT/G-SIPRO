import { describe, expect, it } from "vitest";

import { rotuloDaEsfera } from "@/modules/scouting/domain/esfera";

describe("rótulo da esfera", () => {
  it("traduz as siglas do PNCP", () => {
    expect(rotuloDaEsfera("M")).toBe("Municipal");
    expect(rotuloDaEsfera("F")).toBe("Federal");
  });

  it("aceita a sigla como vier, com espaço ou minúscula", () => {
    expect(rotuloDaEsfera(" e ")).toBe("Estadual");
  });

  /** Sigla desconhecida não pode virar texto inventado no cadastro do órgão. */
  it("devolve indefinido para sigla ausente ou fora da tabela", () => {
    expect(rotuloDaEsfera(undefined)).toBeUndefined();
    expect(rotuloDaEsfera("X")).toBeUndefined();
  });
});
