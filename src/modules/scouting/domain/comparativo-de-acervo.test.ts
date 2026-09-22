import { describe, expect, it } from "vitest";

import type { CoverageItem } from "@/modules/scouting/domain/archive-adherence";
import { compararAcervo, resumoDoComparativo } from "@/modules/scouting/domain/comparativo-de-acervo";

const item = (parcial: Partial<CoverageItem> = {}): CoverageItem => ({
  categoryId: "pavimentacao",
  label: "Pavimentação asfáltica",
  covered: true,
  evidenceCount: 1,
  examples: [],
  ...parcial,
});

const comQuantidade = (parcial: Partial<CoverageItem>, quantidade: Partial<CoverageItem["quantity"]> = {}) =>
  item({
    ...parcial,
    quantity: {
      verdict: "COVERED",
      required: { value: 65_010, unit: "m²" },
      comparable: 1,
      ignored: 0,
      explanation: "",
      ...quantidade,
    } as CoverageItem["quantity"],
  });

describe("o que a licitação exige", () => {
  it("mostra número e unidade quando o edital traz quantitativo", () => {
    const [linha] = compararAcervo([comQuantidade({}, { best: 70_000 })]);
    expect(linha?.exigido).toBe("65.010 m²");
  });

  /** Edital sem quantitativo é comum; inventar número ali seria pior. */
  it("diz que não há quantitativo quando o edital não trouxe", () => {
    const [linha] = compararAcervo([item()]);
    expect(linha?.exigido).toBe("sem quantitativo no edital");
  });
});

describe("o que a empresa tem", () => {
  it("traz o maior atestado e a soma, com quantos atestados sustentam", () => {
    const [linha] = compararAcervo([
      comQuantidade({ evidenceCount: 3 }, { best: 42_000, total: 78_000, comparable: 3, verdict: "BELOW" }),
    ]);
    expect(linha?.acervo).toBe("maior 42.000 m² · soma 78.000 m² · 3 atestados");
  });

  /** Com um atestado só, maior e soma são o mesmo número: repetir confunde. */
  it("não repete a soma quando existe um atestado só", () => {
    const [linha] = compararAcervo([comQuantidade({ evidenceCount: 1 }, { best: 42_000, total: 42_000 })]);
    expect(linha?.acervo).toBe("maior 42.000 m² · 1 atestado");
  });

  it("sem atestado nenhum, diz isso com todas as letras", () => {
    const [linha] = compararAcervo([item({ evidenceCount: 0, covered: false })]);
    expect(linha?.acervo).toBe("nenhum atestado");
    expect(linha?.situacao).toBe("FALTA");
  });

  it("sem quantitativo exigido, conta os atestados", () => {
    const [linha] = compararAcervo([item({ evidenceCount: 2 })]);
    expect(linha?.acervo).toBe("2 atestados");
  });
});

describe("situação de cada serviço", () => {
  it.each([
    ["COVERED", "ATENDE"],
    ["BELOW", "NAO_ALCANCA"],
    ["INCOMPARABLE", "SEM_COMPARACAO"],
  ] as const)("veredito %s vira %s", (verdict, esperado) => {
    const [linha] = compararAcervo([comQuantidade({ evidenceCount: 2 }, { verdict, best: 10 })]);
    expect(linha?.situacao).toBe(esperado);
  });

  /**
   * Faltar atestado vence qualquer veredito de quantidade: sem prova do
   * serviço, o número não importa.
   */
  it("sem atestado é falta, mesmo com quantitativo exigido", () => {
    const [linha] = compararAcervo([comQuantidade({ evidenceCount: 0, covered: false }, { verdict: "INCOMPARABLE" })]);
    expect(linha?.situacao).toBe("FALTA");
  });
});

describe("ressalvas", () => {
  /** Atestado fora da conta muda a leitura da linha e não pode sumir. */
  it("avisa quando atestados ficaram fora por unidade incompatível", () => {
    const [linha] = compararAcervo([
      comQuantidade({ evidenceCount: 4 }, { best: 42_000, comparable: 2, ignored: 2 }),
    ]);
    expect(linha?.ressalva).toContain("2 atestados fora da conta");
  });

  it("avisa quando o serviço é comprovado mas o quantitativo não dá para comparar", () => {
    const [linha] = compararAcervo([
      comQuantidade({ evidenceCount: 1 }, { verdict: "INCOMPARABLE", comparable: 0 }),
    ]);
    expect(linha?.ressalva).toContain("sem quantitativo comparável");
  });

  it("linha sem nada a ressalvar não carrega ressalva", () => {
    const [linha] = compararAcervo([comQuantidade({ evidenceCount: 1 }, { best: 70_000 })]);
    expect(linha?.ressalva).toBeUndefined();
  });
});

describe("placar do comparativo", () => {
  it("conta por situação", () => {
    const linhas = compararAcervo([
      comQuantidade({ evidenceCount: 1 }, { best: 70_000 }),
      comQuantidade({ evidenceCount: 2 }, { verdict: "BELOW", best: 10 }),
      item({ evidenceCount: 0, covered: false }),
    ]);
    expect(resumoDoComparativo(linhas)).toMatchObject({ atende: 1, naoAlcanca: 1, falta: 1, total: 3 });
  });
});
