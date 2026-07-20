import { describe, expect, it } from "vitest";
import { proposalDraftSchema, proposalVersionSchema } from "./proposal";

const opportunityId = "00000000-0000-4000-8000-000000000001";
const tenderVersionId = "00000000-0000-4000-8000-000000000002";
const tenderLotId = "00000000-0000-4000-8000-000000000003";

describe("proposalDraftSchema", () => {
  it("aceita proposta vinculada somente à oportunidade", () => { expect(proposalDraftSchema.parse({ code: " prop-001 ", opportunityId }).code).toBe("PROP-001"); });
  it("aceita edital e lote informados em conjunto", () => { expect(proposalDraftSchema.parse({ code: "PROP-002", opportunityId, tenderVersionId, tenderLotId }).tenderLotId).toBe(tenderLotId); });
  it("rejeita edital sem lote", () => { expect(() => proposalDraftSchema.parse({ code: "PROP-003", opportunityId, tenderVersionId })).toThrow(); });
  it("rejeita campos não aprovados no corte", () => { expect(() => proposalDraftSchema.parse({ code: "PROP-004", opportunityId, margin: 20 })).toThrow(); });
  it("exige justificativa para nova versão", () => { expect(() => proposalVersionSchema.parse({ reason: "curta" })).toThrow(); });
});
