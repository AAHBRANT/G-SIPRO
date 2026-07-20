import { describe, expect, it } from "vitest";

import {
  assertOpportunityTransition,
  collectCriticalChanges,
  opportunityDraftSchema,
  OpportunityRuleError,
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
    expect(opportunityDraftSchema.parse({ code: "OP-TESTE-001", origin: "PORTAL" })).toEqual({
      code: "OP-TESTE-001",
      origin: "PORTAL",
    });
  });

  it("exige moeda e fonte quando há valor estimado", () => {
    expect(() => opportunityDraftSchema.parse({ code: "OP-1", origin: "CUSTOMER", estimatedValue: 100 })).toThrow();
  });

  it("bloqueia ativação sem objeto e responsável", () => {
    expect(() =>
      assertOpportunityTransition({ code: "OP-1", origin: "PORTAL", status: "QUALIFICATION" }, "ACTIVE"),
    ).toThrow(OpportunityRuleError);
  });

  it("permite ativação com dados mínimos", () => {
    expect(() => assertOpportunityTransition(completeOpportunity, "ACTIVE")).not.toThrow();
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

  it("registra somente campos críticos alterados", () => {
    expect(
      collectCriticalChanges(
        { subject: "A", ownerId: "1", currency: "BRL", customerId: "cliente-1" },
        { subject: "B", ownerId: "1", currency: "BRL", customerId: "cliente-2" },
      ),
    ).toEqual({ subject: { from: "A", to: "B" } });
  });
});
