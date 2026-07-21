import { describe, expect, it } from "vitest";
import { supportClarificationSchema, supportMessageSchema, supportValidationSchema } from "./support-ticket";

describe("supportMessageSchema", () => {
  it("normaliza uma mensagem válida", () => {
    expect(supportMessageSchema.parse({ message: "  Podemos validar este ponto?  " })).toEqual({ message: "Podemos validar este ponto?" });
  });

  it("rejeita mensagem vazia", () => {
    expect(() => supportMessageSchema.parse({ message: "   " })).toThrow();
  });
});

describe("support requester validation", () => {
  it("accepts at most five guided questions with ready-made options", () => {
    expect(supportClarificationSchema.parse({ introduction: "Confirme os pontos objetivos abaixo.", questions: [{ id: "environment", question: "Onde o problema foi testado?", options: ["Teams", "Navegador"] }] }).questions).toHaveLength(1);
  });

  it("rejects more than five questions", () => {
    const questions = Array.from({ length: 6 }, (_, index) => ({ id: String(index), question: "Qual comportamento foi observado?", options: ["Sempre", "Às vezes"] }));
    expect(supportClarificationSchema.safeParse({ introduction: "Confirme os pontos objetivos abaixo.", questions }).success).toBe(false);
  });

  it("requires a reason when the requester says the problem persists", () => {
    expect(supportValidationSchema.safeParse({ action: "REPORT_UNRESOLVED", reason: "" }).success).toBe(false);
    expect(supportValidationSchema.safeParse({ action: "REPORT_UNRESOLVED", reason: "O erro ainda aparece." }).success).toBe(true);
  });
});
