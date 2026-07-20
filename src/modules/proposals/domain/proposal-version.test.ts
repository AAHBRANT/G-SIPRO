import { describe, expect, it } from "vitest";
import { proposalVersionSchema } from "./proposal";

describe("proposalVersionSchema", () => {
  it("aceita justificativa rastreável", () => { expect(proposalVersionSchema.parse({ reason: "Correção dos dados comerciais." }).reason).toBe("Correção dos dados comerciais."); });
  it("remove espaços externos", () => { expect(proposalVersionSchema.parse({ reason: "  Revisão técnica solicitada.  " }).reason).toBe("Revisão técnica solicitada."); });
  it("rejeita justificativa insuficiente", () => { expect(() => proposalVersionSchema.parse({ reason: "curta" })).toThrow(); });
  it("rejeita campos não previstos", () => { expect(() => proposalVersionSchema.parse({ reason: "Revisão comercial completa.", version: 8 })).toThrow(); });
});
