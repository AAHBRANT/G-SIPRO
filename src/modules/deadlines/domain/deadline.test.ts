import { describe, expect, it } from "vitest";
import { confirmDeadlineSchema, deadlineSchema } from "./deadline";

const base = { tenderId: "11111111-1111-4111-8111-111111111111", event: "Entrega da proposta", dueAt: "2026-08-01T12:00:00-03:00", timeZone: "America/Sao_Paulo", source: "Edital v2, página 13", responsibleId: "22222222-2222-4222-8222-222222222222" };
describe("prazos de edital", () => {
  it("exige fuso, fonte e responsável", () => expect(() => deadlineSchema.parse({ ...base, timeZone: "" })).toThrow());
  it("impede alerta posterior ao prazo", () => expect(() => deadlineSchema.parse({ ...base, alerts: ["2026-08-02T12:00:00-03:00"] })).toThrow());
  it("exige justificativa na confirmação humana", () => expect(() => confirmDeadlineSchema.parse({ reason: "curta" })).toThrow());
});
