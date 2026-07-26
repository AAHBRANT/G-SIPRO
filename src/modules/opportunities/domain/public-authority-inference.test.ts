import { describe, expect, it } from "vitest";

import { inferPublicAuthorityFromValueSource } from "./public-authority-inference";

describe("inferPublicAuthorityFromValueSource", () => {
  it("reconhece prefeitura como órgão municipal", () => {
    expect(inferPublicAuthorityFromValueSource("Prefeitura de Gravataí")).toEqual({
      name: "Prefeitura de Gravataí",
      sphere: "MUNICIPAL",
      locality: "Gravataí",
    });
  });

  it("normaliza município e governo estadual", () => {
    expect(inferPublicAuthorityFromValueSource("Município de São Paulo")?.sphere).toBe("MUNICIPAL");
    expect(inferPublicAuthorityFromValueSource("Governo do Estado de Minas Gerais")).toEqual({
      name: "Governo do Estado de Minas Gerais",
      sphere: "STATE",
      locality: "Minas Gerais",
    });
  });

  it("não transforma referências documentais em contratantes", () => {
    expect(inferPublicAuthorityFromValueSource("Edital 007/2026")).toBeUndefined();
    expect(inferPublicAuthorityFromValueSource("Portal de Compras Públicas")).toBeUndefined();
  });
});
