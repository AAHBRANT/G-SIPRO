import { describe, expect, it } from "vitest";
import { technicalSectionDraftSchema, technicalSectionUpdateSchema } from "./technical-section";

const responsibleId = "00000000-0000-4000-8000-000000000001";
describe("technicalSectionDraftSchema", () => {
  it("aceita seção ordenada com responsável humano", () => { expect(technicalSectionDraftSchema.parse({ type: "Metodologia", title: "Metodologia executiva", position: 1, responsibleId }).position).toBe(1); });
  it("aceita vínculos múltiplos com requisitos", () => { expect(technicalSectionDraftSchema.parse({ type: "Equipe", title: "Equipe técnica", position: 2, responsibleId, requirementIds: [responsibleId] }).requirementIds).toHaveLength(1); });
  it("rejeita posição não positiva", () => { expect(() => technicalSectionDraftSchema.parse({ type: "Equipe", title: "Equipe técnica", position: 0, responsibleId })).toThrow(); });
  it("rejeita campo não aprovado", () => { expect(() => technicalSectionDraftSchema.parse({ type: "Equipe", title: "Equipe técnica", position: 1, responsibleId, automaticApproval: true })).toThrow(); });
});
describe("technicalSectionUpdateSchema", () => {
  it("controla responsável, status e versão concorrente", () => { expect(technicalSectionUpdateSchema.parse({ responsibleId, status: "IN_PROGRESS", version: 1 }).status).toBe("IN_PROGRESS"); });
  it("rejeita status inexistente", () => { expect(() => technicalSectionUpdateSchema.parse({ responsibleId, status: "SENT", version: 1 })).toThrow(); });
});
