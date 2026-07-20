import { describe, expect, it } from "vitest";
import { requirementSchema } from "./requirement";

const base = {
  tenderVersionId: "11111111-1111-4111-8111-111111111111",
  type: "HABILITATION",
  text: "Apresentar atestado de capacidade técnica.",
  criticality: "CRITICAL" as const,
  responsibleId: "22222222-2222-4222-8222-222222222222",
  sourceExcerpt: "A licitante deverá apresentar...",
  sourcePage: 12,
};

describe("requisito de edital", () => {
  it("exige trecho e página da versão de origem", () => {
    expect(() => requirementSchema.parse({ ...base, sourceExcerpt: "" })).toThrow();
    expect(() => requirementSchema.parse({ ...base, sourcePage: 0 })).toThrow();
  });

  it("aceita requisito completo com responsável", () => {
    expect(requirementSchema.parse(base)).toMatchObject({ criticality: "CRITICAL", sourcePage: 12 });
  });
});
