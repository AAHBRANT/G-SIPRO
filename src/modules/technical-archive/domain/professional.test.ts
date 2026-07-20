import { describe, expect, it } from "vitest";
import { professionalSchema } from "./professional";

const valid = {
  fullName: "Profissional Sintético",
  council: "crea-sp",
  registrationNumber: "000000",
  nationalRegistration: "2600000000",
  professionalTitle: "Engenheiro Civil",
  processingPurpose: "Comprovar capacidade técnico-profissional em propostas.",
  legalBasis: "Execução de contrato e legítimo interesse documentado",
  links: [{ targetType: "TECHNICAL_EVIDENCE", targetId: "11111111-1111-4111-8111-111111111111", role: "Responsável técnico", responsibility: "Execução da atividade registrada", startedAt: "2024-01-01", endedAt: "2024-12-31", source: "CAT sintética", evidenceDocumentVersionId: "22222222-2222-4222-8222-222222222222" }],
};

describe("professionalSchema", () => {
  it("normaliza o conselho e preserva finalidade e base legal", () => {
    const parsed = professionalSchema.parse(valid);
    expect(parsed.council).toBe("CREA-SP");
    expect(parsed.processingPurpose).toContain("capacidade");
  });

  it("exige ao menos um vínculo comprovado", () => {
    expect(() => professionalSchema.parse({ ...valid, links: [] })).toThrow();
  });

  it("rejeita período invertido", () => {
    expect(() => professionalSchema.parse({ ...valid, links: [{ ...valid.links[0], endedAt: "2023-12-31" }] })).toThrow();
  });

  it("rejeita campos pessoais não previstos pelo modelo minimizado", () => {
    expect(() => professionalSchema.parse({ ...valid, cpf: "000.000.000-00" })).toThrow();
  });
});
