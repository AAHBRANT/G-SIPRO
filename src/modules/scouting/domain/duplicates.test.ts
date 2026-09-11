import { describe, expect, it } from "vitest";

import {
  findDuplicates,
  resolveDuplicates,
  type DuplicateInput,
  type DuplicateResolutionInput,
} from "@/modules/scouting/domain/duplicates";

const item = (parcial: Partial<DuplicateInput> & { id: string }): DuplicateInput => ({
  authorityName: "MUNICÍPIO DE EXEMPLO",
  subject: "Contratação de empresa especializada para execução de ponte em concreto armado sobre o rio Preto",
  ...parcial,
});

const itemComData = (parcial: Partial<DuplicateResolutionInput> & { id: string }): DuplicateResolutionInput => ({
  ...item(parcial),
  createdAt: new Date("2026-01-01T00:00:00Z"),
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

  /**
   * Achado em produção: Santa Lúcia/PR, mesma obra em duas linhas idênticas
   * (objeto, valor, prazo) e nenhum aviso de republicação — o campo de
   * documento do órgão nem sempre volta preenchido pelo PNCP, e a versão
   * anterior escolhia "documento OU nome" por item, não por órgão: uma
   * licitação virava chave de dígitos e a outra de texto, e as duas nunca
   * batiam mesmo sendo a mesma obra.
   */
  it("agrupa mesmo quando só um dos dois avisos veio com o documento do órgão", () => {
    const d = findDuplicates([
      item({ id: "a", authorityDocument: "07658917000127" }),
      item({ id: "b" }),
    ]);
    expect(d.get("a")).toEqual(["b"]);
    expect(d.get("b")).toEqual(["a"]);
  });

  /**
   * O mesmo defeito do documento do órgão, uma camada abaixo: a versão
   * anterior escolhia "processo OU objeto" por item, não por par. Uma
   * licitação com processo capturado e sua gêmea sem processo (mesma
   * armadilha: o campo nem sempre volta preenchido do PNCP) nunca se
   * encontravam, mesmo com o objeto idêntico.
   */
  it("agrupa mesmo quando só um dos dois avisos veio com o número de processo", () => {
    const objeto = "Contratação de empresa especializada para pavimentação asfáltica da avenida principal";
    const d = findDuplicates([
      item({ id: "a", authorityDocument: "07658917000127", processNumber: "2026-16974-0", subject: objeto }),
      item({ id: "b", authorityDocument: "07658917000127", subject: objeto }),
    ]);
    expect(d.get("a")).toEqual(["b"]);
    expect(d.get("b")).toEqual(["a"]);
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

describe("quem sobrevive quando é a mesma obra", () => {
  it("a publicação mais recente vence", () => {
    const r = resolveDuplicates([
      itemComData({ id: "antiga", authorityDocument: "07658917000127", publishedAt: new Date("2026-07-01") }),
      itemComData({ id: "nova", authorityDocument: "07658917000127", publishedAt: new Date("2026-08-15") }),
    ]);
    expect(r.get("antiga")).toBe("nova");
    expect(r.has("nova")).toBe(false);
  });

  it("sem data de publicação em nenhuma das duas, usa quando foi captada", () => {
    const r = resolveDuplicates([
      itemComData({ id: "capturada-primeiro", authorityDocument: "07658917000127", createdAt: new Date("2026-08-01") }),
      itemComData({ id: "capturada-depois", authorityDocument: "07658917000127", createdAt: new Date("2026-08-20") }),
    ]);
    expect(r.get("capturada-primeiro")).toBe("capturada-depois");
  });

  it("grupo de três: só as duas mais antigas perdem, e as duas apontam pra mesma sobrevivente", () => {
    const r = resolveDuplicates([
      itemComData({ id: "a", authorityDocument: "07658917000127", processNumber: "2026-16974-0", publishedAt: new Date("2026-06-01") }),
      itemComData({ id: "b", authorityDocument: "07658917000127", processNumber: "2026-16974-0", publishedAt: new Date("2026-07-01") }),
      itemComData({ id: "c", authorityDocument: "07658917000127", processNumber: "2026-16974-0", publishedAt: new Date("2026-08-01") }),
    ]);
    expect(r.get("a")).toBe("c");
    expect(r.get("b")).toBe("c");
    expect(r.has("c")).toBe(false);
  });

  it("licitação sem par não aparece no mapa", () => {
    const r = resolveDuplicates([itemComData({ id: "a", authorityDocument: "07658917000127" })]);
    expect(r.size).toBe(0);
  });

  it("lista vazia não quebra", () => {
    expect(resolveDuplicates([]).size).toBe(0);
  });
});
