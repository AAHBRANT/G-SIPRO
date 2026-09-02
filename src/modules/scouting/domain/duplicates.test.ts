import { describe, expect, it } from "vitest";

import { findDuplicates, type DuplicateInput } from "@/modules/scouting/domain/duplicates";

const item = (parcial: Partial<DuplicateInput> & { id: string }): DuplicateInput => ({
  authorityName: "MUNICÍPIO DE EXEMPLO",
  subject: "Contratação de empresa especializada para execução de ponte em concreto armado sobre o rio Preto",
  ...parcial,
});

describe("mesma obra publicada duas vezes", () => {
  it("agrupa pelo número do processo, mesmo escrito diferente", () => {
    const d = findDuplicates([
      item({ id: "a", authorityDocument: "07658917000127", processNumber: "2026-16974-0" }),
      item({ id: "b", authorityDocument: "07658917000127", processNumber: "2026/16974/0", subject: "Objeto reescrito na republicação, com outras palavras" }),
    ]);
    expect(d.get("a")).toEqual(["b"]);
    expect(d.get("b")).toEqual(["a"]);
  });

  it("agrupa pelo objeto quando não há número de processo", () => {
    const d = findDuplicates([item({ id: "a" }), item({ id: "b" })]);
    expect(d.get("a")).toEqual(["b"]);
  });

  it("três avisos do mesmo processo apontam um para os outros dois", () => {
    const comum = { authorityDocument: "07658917000127", processNumber: "2026-16974-0" };
    const d = findDuplicates([item({ id: "a", ...comum }), item({ id: "b", ...comum }), item({ id: "c", ...comum })]);
    expect(d.get("a")).toEqual(["b", "c"]);
  });
});

describe("o que NÃO pode ser agrupado", () => {
  /** Agrupar obras distintas é pior que mostrar duas linhas parecidas. */
  it("mesmo objeto em órgãos diferentes não é duplicata", () => {
    const d = findDuplicates([
      item({ id: "a", authorityDocument: "07658917000127" }),
      item({ id: "b", authorityDocument: "11222333000144" }),
    ]);
    expect(d.size).toBe(0);
  });

  it("objeto curto não agrupa: repete-se em municípios diferentes", () => {
    const d = findDuplicates([
      item({ id: "a", authorityDocument: "07658917000127", subject: "Reforma de escola" }),
      item({ id: "b", authorityDocument: "07658917000127", subject: "Reforma de creche" }),
    ]);
    expect(d.size).toBe(0);
  });

  it("número de processo curto demais não serve de chave", () => {
    const d = findDuplicates([
      item({ id: "a", authorityDocument: "07658917000127", processNumber: "12", subject: "Objeto A curto" }),
      item({ id: "b", authorityDocument: "07658917000127", processNumber: "34", subject: "Objeto B curto" }),
    ]);
    expect(d.size).toBe(0);
  });

  it("licitação sozinha não aparece no mapa", () => {
    expect(findDuplicates([item({ id: "a", authorityDocument: "07658917000127" })]).size).toBe(0);
  });

  it("lista vazia não quebra", () => {
    expect(findDuplicates([]).size).toBe(0);
  });
});
