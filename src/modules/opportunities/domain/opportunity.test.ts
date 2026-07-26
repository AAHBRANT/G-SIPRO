import { describe, expect, it } from "vitest";

import {
  assertOpportunityTransition,
  collectCriticalChanges,
  formatOpportunityCode,
  opportunityDraftSchema,
  OpportunityRuleError,
  shouldConvertOpportunityToProposal,
  type OpportunityLifecycleSnapshot,
} from "@/modules/opportunities/domain/opportunity";

const completeOpportunity: OpportunityLifecycleSnapshot = {
  code: "OP-TESTE-001",
  origin: "PORTAL",
  subject: "Execução de obra sintética para teste",
  ownerId: "46949ef2-c787-4a84-bcd1-9606295fbeb6",
  status: "QUALIFICATION",
};

describe("regras de oportunidade", () => {
  it("aceita rascunho mínimo sem inventar valor ou data", () => {
    expect(opportunityDraftSchema.parse({ origin: "PORTAL" })).toEqual({
      origin: "PORTAL",
    });
  });

  it("exige moeda e fonte quando há valor estimado", () => {
    expect(() => opportunityDraftSchema.parse({ origin: "CUSTOMER", estimatedValue: 100 })).toThrow();
  });

  it("bloqueia ativação sem objeto e responsável", () => {
    expect(() =>
      assertOpportunityTransition({ code: "OP-1", origin: "PORTAL", status: "QUALIFICATION" }, "ACTIVE"),
    ).toThrow(OpportunityRuleError);
  });

  it("permite ativação com dados mínimos", () => {
    expect(() => assertOpportunityTransition(completeOpportunity, "ACTIVE")).not.toThrow();
  });

  it("converte apenas quando a oportunidade validada entra no estado ativo", () => {
    expect(shouldConvertOpportunityToProposal("QUALIFICATION", "ACTIVE")).toBe(true);
    expect(shouldConvertOpportunityToProposal("ACTIVE", "SUSPENDED")).toBe(false);
  });

  it("exige motivo para encerramento", () => {
    expect(() => assertOpportunityTransition({ ...completeOpportunity, status: "ACTIVE" }, "CLOSED")).toThrow(
      OpportunityRuleError,
    );
  });

  it("impede salto direto de rascunho para ativa", () => {
    expect(() => assertOpportunityTransition({ ...completeOpportunity, status: "DRAFT" }, "ACTIVE")).toThrow(
      OpportunityRuleError,
    );
  });

  it("permite somente reabertura justificada", () => {
    expect(() =>
      assertOpportunityTransition(
        { ...completeOpportunity, status: "CLOSED" },
        "QUALIFICATION",
        undefined,
        "Nova evidência recebida",
      ),
    ).not.toThrow();
    expect(() =>
      assertOpportunityTransition({ ...completeOpportunity, status: "CLOSED" }, "QUALIFICATION"),
    ).toThrow(OpportunityRuleError);
  });

  it("formata o código sequencial com prefixo e ano de 2 dígitos", () => {
    expect(formatOpportunityCode(10, 2026)).toBe("PPB-010-26");
  });

  it("reinicia visualmente a cada ano, mesmo com sequencial baixo", () => {
    expect(formatOpportunityCode(1, 2027)).toBe("PPB-001-27");
  });

  it("preserva 3 dígitos mínimos e permite crescer além disso", () => {
    expect(formatOpportunityCode(999, 2026)).toBe("PPB-999-26");
    expect(formatOpportunityCode(1000, 2026)).toBe("PPB-1000-26");
  });

  it("registra somente campos críticos alterados", () => {
    expect(
      collectCriticalChanges(
        { subject: "A", ownerId: "1", currency: "BRL", customerId: "cliente-1" },
        { subject: "B", ownerId: "1", currency: "BRL", customerId: "cliente-2" },
      ),
    ).toEqual({
      subject: { from: "A", to: "B" },
      customerId: { from: "cliente-1", to: "cliente-2" },
    });
  });
});
