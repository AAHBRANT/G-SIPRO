import { describe, expect, it } from "vitest";

import type { EditalRequirement } from "@/modules/scouting/domain/edital-requirement";
import { requisitosDoEdital } from "@/modules/scouting/domain/requisitos-do-edital";
import { requirementSchema } from "@/modules/requirements/domain/requirement";

const VERSAO = "33333333-3333-4333-8333-333333333333";
const PESSOA = "44444444-4444-4444-8444-444444444444";

const leitura = (parcial: Partial<EditalRequirement> = {}): EditalRequirement => ({
  services: [],
  limitations: [],
  ...parcial,
});

const gerar = (parcial: Partial<EditalRequirement> = {}) => requisitosDoEdital(leitura(parcial), VERSAO, PESSOA);

describe("parcelas viram requisitos técnicos", () => {
  it("leva a descrição e o quantitativo do edital", () => {
    const [requisito] = gerar({
      services: [{ description: "Pavimentação asfáltica em CBUQ", quantity: 65_010, unit: "m²" }],
    });

    expect(requisito?.type).toBe("TECHNICAL");
    expect(requisito?.criticality).toBe("HIGH");
    expect(requisito?.text).toContain("Pavimentação asfáltica em CBUQ");
    expect(requisito?.text).toContain("65.010 m²");
  });

  /** Sem quantitativo, o texto não pode inventar número nenhum. */
  it("parcela sem quantitativo não ganha número", () => {
    const [requisito] = gerar({ services: [{ description: "Drenagem urbana" }] });
    expect(requisito?.text).toBe("Parcela de maior relevância: Drenagem urbana");
  });

  it("o trecho de origem é a descrição crua, para conferir contra o PDF", () => {
    const [requisito] = gerar({ services: [{ description: "Rede de esgoto DN 400" }] });
    expect(requisito?.sourceExcerpt).toBe("Rede de esgoto DN 400");
  });
});

describe("exigências de participação", () => {
  /**
   * Sem consórcio, quem depende de parceiro para fechar o acervo está fora —
   * é decisão de participar, não detalhe de preenchimento.
   */
  it("consórcio vedado é crítico", () => {
    const [requisito] = gerar({ consortiumAllowed: false });
    expect(requisito?.criticality).toBe("CRITICAL");
    expect(requisito?.text).toContain("Vedada");
  });

  it("consórcio admitido entra como informação, não como impedimento", () => {
    const [requisito] = gerar({ consortiumAllowed: true });
    expect(requisito?.criticality).toBe("LOW");
  });

  /** Ponto que o edital não respondeu não pode virar exigência. */
  it("consórcio não determinado não gera requisito nenhum", () => {
    expect(gerar({})).toHaveLength(0);
  });

  it("CAT, visita técnica e garantia de proposta viram requisitos próprios", () => {
    const requisitos = gerar({ requiresCat: true, requiresSiteVisit: true, requiresProposalBond: true });
    expect(requisitos.map((r) => r.type)).toEqual(["CAT", "HABILITATION", "FINANCIAL_QUALIFICATION"]);
    expect(requisitos.every((r) => r.criticality === "HIGH")).toBe(true);
  });

  it("o que a leitura não conseguiu determinar não vira requisito", () => {
    expect(gerar({ limitations: ["não localizou o item de garantia"] })).toHaveLength(0);
  });
});

describe("compatibilidade com o módulo de requisitos", () => {
  /**
   * Quem valida de verdade é `requirementSchema`. Como isso roda em segundo
   * plano, um campo fora do contrato falharia calado.
   */
  it("todo requisito gerado passa na validação do módulo", () => {
    const requisitos = gerar({
      services: [{ description: "Ponte em concreto armado", quantity: 120, unit: "m" }],
      consortiumAllowed: false,
      requiresCat: true,
      requiresSiteVisit: true,
      requiresProposalBond: true,
    });

    expect(requisitos).toHaveLength(5);
    for (const requisito of requisitos) {
      expect(() => requirementSchema.parse(requisito)).not.toThrow();
    }
  });

  /** O banco recusa página zero; a leitura não sabe a página. Ver o domínio. */
  it("a página de origem é sempre positiva, mesmo sem a leitura saber qual é", () => {
    const requisitos = gerar({ services: [{ description: "Terraplenagem" }] });
    expect(requisitos[0]?.sourcePage).toBeGreaterThan(0);
  });
});
