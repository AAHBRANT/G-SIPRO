import { describe, expect, it } from "vitest";
import { technicalEvidenceSchema } from "./technical-evidence";

const base = {
  experienceId: "11111111-1111-4111-8111-111111111111",
  number: "CAT-001",
  issuingBody: "CREA-SP",
  issuedAt: "2025-01-10",
  status: "CURRENT",
  subjectActivity: "Execução de estrutura de concreto",
  professionalName: "Profissional de Teste",
  professionalIdentifier: "CREA 000000",
  startedAt: "2024-01-01",
  endedAt: "2024-12-31",
  documentVersionId: "22222222-2222-4222-8222-222222222222",
};

describe("technicalEvidenceSchema", () => {
  it("aceita CAT com profissional, período e documento versionado", () => {
    expect(technicalEvidenceSchema.parse({ ...base, type: "CAT" }).type).toBe("CAT");
  });

  it("aceita ART vinculada a CAT", () => {
    expect(technicalEvidenceSchema.parse({ ...base, type: "ART", number: "ART-001", relatedCatId: "33333333-3333-4333-8333-333333333333" }).relatedCatId).toBeDefined();
  });

  it("rejeita CAT sem profissional", () => {
    expect(() => technicalEvidenceSchema.parse({ ...base, type: "CAT", professionalName: undefined })).toThrow();
  });

  it("rejeita validade anterior à emissão", () => {
    expect(() => technicalEvidenceSchema.parse({ ...base, type: "ATTESTATION", professionalName: undefined, startedAt: undefined, endedAt: undefined, validUntil: "2025-01-01" })).toThrow();
  });
});
