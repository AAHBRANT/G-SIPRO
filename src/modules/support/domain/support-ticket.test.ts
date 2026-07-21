import { describe, expect, it } from "vitest";
import { supportMessageSchema } from "./support-ticket";

describe("supportMessageSchema", () => {
  it("normaliza uma mensagem válida", () => {
    expect(supportMessageSchema.parse({ message: "  Podemos validar este ponto?  " })).toEqual({ message: "Podemos validar este ponto?" });
  });

  it("rejeita mensagem vazia", () => {
    expect(() => supportMessageSchema.parse({ message: "   " })).toThrow();
  });
});
