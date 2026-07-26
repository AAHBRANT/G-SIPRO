import { describe, expect, it } from "vitest";

import { calculateFinancialAssessment, financialAssessmentDraftSchema } from "./financial-assessment";

const base = {
  periodStart: "2025-01-01",
  periodEnd: "2025-12-31",
  conclusion: "ADEQUATE" as const,
  justification: "Avaliação formal emitida pela área financeira responsável.",
  evidence: [{ sourceType: "BALANCE_SHEET", sourceReference: "Balanço 2025", sourceDate: "2025-12-31" }],
  confirmedAt: "2026-07-24T12:00:00.000-03:00",
};

describe("financial assessment", () => {
  it("creates a critical risk when a tender-required index fails", () => {
    const draft = financialAssessmentDraftSchema.parse({
      ...base,
      indices: [{
        code: "LG",
        name: "Liquidez geral",
        formulaDescription: "Ativos sobre passivos",
        comparison: "GTE",
        requiredLimit: 1,
        actualValue: 0.8,
        sourceReference: "Edital e balanço",
        sourceDate: "2025-12-31",
      }],
    });
    const result = calculateFinancialAssessment(draft);
    expect(result.highIndebtednessRisk).toBe(true);
    expect(result.conclusion).toBe("HIGH_RISK");
    expect(result.failedIndexCodes).toEqual(["LG"]);
  });

  it("does not convert absent indices into zero or an automatic risk", () => {
    const draft = financialAssessmentDraftSchema.parse({
      ...base,
      indices: [],
      conclusion: "INSUFFICIENT_DATA",
    });
    expect(calculateFinancialAssessment(draft).highIndebtednessRisk).toBe(false);
  });
});
