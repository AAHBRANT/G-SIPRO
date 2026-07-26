import { describe, expect, it, vi } from "vitest";
import { IntelligencePolicyService, type IntelligencePolicyRepository } from "./intelligence-policy-service";

const actorId = "00000000-0000-4000-8000-000000000001";
const validPolicy = {
  code: "OPPORTUNITY_INTELLIGENCE",
  name: "Modo Analítico Inteligente",
  purpose: "Apoiar a decisão de participação em oportunidades.",
  dimensions: [
    { perspective: "COMMERCIAL", code: "ATTRACTIVENESS", name: "Atratividade comercial", critical: false },
    { perspective: "TECHNICAL", code: "OPERATIONAL_CAPACITY", name: "Capacidade operacional", critical: true },
    { perspective: "STUDIES", code: "PRACTICABILITY", name: "Estudos e praticabilidade", critical: false },
  ],
  weights: { commercial: 35, technical: 40, studies: 25 },
  thresholds: { recommendedMinimum: 80, restrictionsMinimum: 60, minimumConfidence: 70 },
  impedimentRules: [
    { type: "HIGH_INDEBTEDNESS_RISK", enabled: true, description: "Reprovação financeira formal." },
    { type: "NON_PAYING_CUSTOMER", enabled: true, description: "Classificação formal de cliente não pagador." },
  ],
  authorizedSources: ["opportunities"],
  coverageMinimum: 70,
  effectiveFrom: "2026-07-24",
  changeReason: "Criação do T0",
};

const repository = () => ({
  addPolicy: vi.fn(),
  approvePolicy: vi.fn(),
}) as IntelligencePolicyRepository;

describe("IntelligencePolicyService", () => {
  it("delegates a validated policy", async () => {
    const target = repository();
    await new IntelligencePolicyService(target).addPolicy(validPolicy, actorId);
    expect(target.addPolicy).toHaveBeenCalledOnce();
  });

  it("delegates owner approval with a substantive note", async () => {
    const target = repository();
    await new IntelligencePolicyService(target).approvePolicy(
      actorId,
      { note: "Pesos, limites, impedimentos e fontes aprovados." },
      actorId,
    );
    expect(target.approvePolicy).toHaveBeenCalledOnce();
  });
});
