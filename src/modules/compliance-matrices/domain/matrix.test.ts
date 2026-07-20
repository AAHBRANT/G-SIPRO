import { describe, expect, it } from "vitest";
import { complianceMatrixSchema } from "./matrix";

describe("complianceMatrixSchema", () => {
  it("aceita versão do edital e referência de análise", () => {
    expect(complianceMatrixSchema.parse({ tenderVersionId: "00000000-0000-4000-8000-000000000001", analysisReference: "Análise técnica inicial" })).toMatchObject({ analysisReference: "Análise técnica inicial" });
  });

  it("rejeita campos adicionais que antecipariam proposta inexistente", () => {
    expect(() => complianceMatrixSchema.parse({ tenderVersionId: "00000000-0000-4000-8000-000000000001", analysisReference: "Análise inicial", proposalId: "inventado" })).toThrow();
  });
});

