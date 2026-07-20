import { describe, expect, it } from "vitest";
import { technicalCommentResolutionSchema, technicalCommentSchema, technicalContentSchema, technicalEvidenceLinkSchema, technicalReviewSchema } from "./technical-review";
const id = "00000000-0000-4000-8000-000000000001";
describe("technical review schemas", () => {
  it("aceita conteúdo técnico substancial", () => { expect(technicalContentSchema.parse({ content: "Metodologia executiva detalhada para atendimento.", reason: "Elaboração inicial controlada." }).content).toContain("Metodologia"); });
  it("rejeita conteúdo insuficiente", () => { expect(() => technicalContentSchema.parse({ content: "Curto", reason: "Justificativa suficiente." })).toThrow(); });
  it("aceita evidência específica", () => { expect(technicalEvidenceLinkSchema.parse({ technicalEvidenceId: id, locator: "p. 3", justification: "Comprova experiência requerida." }).locator).toBe("p. 3"); });
  it("aceita pendência crítica", () => { expect(technicalCommentSchema.parse({ severity: "CRITICAL", comment: "Detalhar a sequência executiva." }).severity).toBe("CRITICAL"); });
  it("rejeita comentário vazio", () => { expect(() => technicalCommentSchema.parse({ severity: "NORMAL", comment: "curto" })).toThrow(); });
  it("exige resolução explicada", () => { expect(() => technicalCommentResolutionSchema.parse({ resolution: "ok" })).toThrow(); });
  it("aceita decisão humana", () => { expect(technicalReviewSchema.parse({ decision: "APPROVED", justification: "Conteúdo e evidências conferidos." }).decision).toBe("APPROVED"); });
  it("rejeita decisão desconhecida", () => { expect(() => technicalReviewSchema.parse({ decision: "AUTOMATIC", justification: "Decisão automática proibida." })).toThrow(); });
});
