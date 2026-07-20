import { describe, expect, it } from "vitest";
import { archiveSearchSchema } from "./archive-search";

describe("archiveSearchSchema", () => {
  it("aceita pesquisa textual controlada", () => {
    expect(archiveSearchSchema.parse({ discipline: "Saneamento" })).toMatchObject({ discipline: "Saneamento", page: 1, pageSize: 25 });
  });

  it("exige pelo menos um filtro", () => {
    expect(() => archiveSearchSchema.parse({})).toThrow();
  });

  it("exige unidade quando há faixa quantitativa", () => {
    expect(() => archiveSearchSchema.parse({ minQuantity: "100" })).toThrow();
  });

  it("rejeita faixa quantitativa invertida", () => {
    expect(() => archiveSearchSchema.parse({ minQuantity: 200, maxQuantity: 100, unit: "m" })).toThrow();
  });

  it("limita a paginação para evitar extração em massa", () => {
    expect(() => archiveSearchSchema.parse({ service: "adutora", pageSize: 51 })).toThrow();
  });
});

