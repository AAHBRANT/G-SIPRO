import { describe, expect, it } from "vitest";
import { intelligencePolicyApprovalSchema, intelligencePolicySchema } from "./intelligence-policy";

const validPolicy = {
  code: "opportunity_intelligence",
  name: "Modo Analítico Inteligente",
  purpose: "Apoiar a decisão de participação em oportunidades.",
  dimensions: [
    { perspective: "COMMERCIAL" as const, code: "ATTRACTIVENESS", name: "Atratividade comercial", critical: false },
    { perspective: "TECHNICAL" as const, code: "OPERATIONAL_CAPACITY", name: "Capacidade operacional", critical: true },
    { perspective: "STUDIES" as const, code: "PRACTICABILITY", name: "Estudos e praticabilidade", critical: false },
  ],
  weights: { commercial: 35, technical: 40, studies: 25 },
  thresholds: { recommendedMinimum: 80, restrictionsMinimum: 60, minimumConfidence: 70 },
  impedimentRules: [
    { type: "HIGH_INDEBTEDNESS_RISK" as const, enabled: true as const, description: "Reprovação financeira formal." },
    { type: "NON_PAYING_CUSTOMER" as const, enabled: true as const, description: "Classificação formal de cliente não pagador." },
  ],
  authorizedSources: ["opportunities", "technical_archive"],
  coverageMinimum: 70,
  effectiveFrom: "2026-07-24",
  changeReason: "Criação do T0",
};

describe("intelligence policy", () => {
  it("normalizes stable codes and accepts the three approved perspectives", () => {
    const parsed = intelligencePolicySchema.parse(validPolicy);
    expect(parsed.code).toBe("OPPORTUNITY_INTELLIGENCE");
    expect(parsed.dimensions.map(item => item.perspective)).toEqual(["COMMERCIAL", "TECHNICAL", "STUDIES"]);
  });

  it("requires weights to total exactly 100", () => {
    expect(() => intelligencePolicySchema.parse({ ...validPolicy, weights: { commercial: 40, technical: 40, studies: 30 } })).toThrow();
  });

  it("preserves the approved minimum coverage of 70 percent", () => {
    expect(() => intelligencePolicySchema.parse({ ...validPolicy, coverageMinimum: 69 })).toThrow();
  });

  it("requires both approved critical impediments", () => {
    expect(() => intelligencePolicySchema.parse({ ...validPolicy, impedimentRules: validPolicy.impedimentRules.slice(0, 1) })).toThrow();
  });

  it("requires a substantive owner approval note", () => {
    expect(() => intelligencePolicyApprovalSchema.parse({ note: "Aprovado" })).toThrow();
    expect(intelligencePolicyApprovalSchema.parse({ note: "Pesos, limites e fontes aprovados." }).note).toContain("aprovados");
  });
});
