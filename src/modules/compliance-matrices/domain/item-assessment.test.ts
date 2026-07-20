import { describe, expect, it } from "vitest";
import { itemAssessmentSchema } from "./item-assessment";

const responsibleId = "00000000-0000-4000-8000-000000000001";
const treatment = { gapDescription: "Comprovação quantitativa insuficiente.", riskDescription: "Possível inabilitação técnica da proposta.", impact: "Impede o atendimento integral do requisito.", treatment: "Obter evidência complementar antes da consolidação.", responsibleId, dueAt: "2030-08-01T12:00:00-03:00" };

describe("itemAssessmentSchema", () => {
  it("aceita decisão atende com justificativa humana", () => {
    expect(itemAssessmentSchema.parse({ decision: "MEETS", justification: "As evidências comprovam integralmente o requisito." }).decision).toBe("MEETS");
  });

  it("exige tratamento completo para decisão parcial", () => {
    expect(() => itemAssessmentSchema.parse({ decision: "PARTIAL", justification: "Atendimento ainda incompleto.", gapDescription: treatment.gapDescription })).toThrow();
  });

  it("aceita decisão parcial com lacuna, risco, impacto, tratamento, responsável e prazo", () => {
    expect(itemAssessmentSchema.parse({ decision: "PARTIAL", justification: "Atendimento parcial identificado.", ...treatment }).responsibleId).toBe(responsibleId);
  });

  it("rejeita pacote de tratamento incompleto mesmo para atendimento integral", () => {
    expect(() => itemAssessmentSchema.parse({ decision: "MEETS", justification: "Atendimento integral com risco residual.", riskDescription: treatment.riskDescription })).toThrow();
  });
});

