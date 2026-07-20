import { describe, expect, it } from "vitest";
import { matrixEvidenceSchema } from "./matrix-evidence";

const evidenceId = "00000000-0000-4000-8000-000000000001";
const quantityId = "00000000-0000-4000-8000-000000000002";

describe("matrixEvidenceSchema", () => {
  it("aceita evidência sem comparação quantitativa", () => {
    expect(matrixEvidenceSchema.parse({ technicalEvidenceId: evidenceId, locator: "Página 4", justification: "Evidência pertinente ao requisito." }).comparisons).toEqual([]);
  });

  it("aceita comparação com conversão completamente documentada", () => {
    const result = matrixEvidenceSchema.parse({ technicalEvidenceId: evidenceId, locator: "Página 4", justification: "Evidência pertinente ao requisito.", comparisons: [{ executedQuantityId: quantityId, requiredValue: 1000, requiredUnit: "m3", conversionFactor: 0.001, conversionRule: "Converter litros para metros cúbicos.", conversionSource: "Norma técnica sintética" }] });
    expect(result.comparisons[0].conversionFactor).toBe(0.001);
  });

  it("rejeita conversão parcialmente documentada", () => {
    expect(() => matrixEvidenceSchema.parse({ technicalEvidenceId: evidenceId, locator: "Página 4", justification: "Evidência pertinente ao requisito.", comparisons: [{ executedQuantityId: quantityId, requiredValue: 1000, requiredUnit: "m3", conversionFactor: 0.001 }] })).toThrow();
  });
});

