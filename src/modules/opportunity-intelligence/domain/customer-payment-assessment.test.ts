import { describe, expect, it } from "vitest";

import {
  calculateCustomerPaymentAssessment,
  customerPaymentAssessmentDraftSchema,
} from "./customer-payment-assessment";

describe("customer payment assessment", () => {
  it("only creates a nonpayer blocker from a formal classification", () => {
    const result = calculateCustomerPaymentAssessment(customerPaymentAssessmentDraftSchema.parse({
      customerId: "00000000-0000-4000-8000-000000000001",
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      classification: "ATTENTION",
      authorizedMetrics: { overdueCount: 10, averageDelayDays: 120 },
      justification: "Classificação formal da área financeira com evidências autorizadas.",
      evidence: [{ sourceType: "ERP", sourceReference: "Relatório 2025", sourceDate: "2025-12-31" }],
      confirmedAt: "2026-07-24T12:00:00.000-03:00",
    }));
    expect(result.nonPayingCustomer).toBe(false);
  });

  it("requires exactly one assessed subject", () => {
    const parsed = customerPaymentAssessmentDraftSchema.safeParse({
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      classification: "INSUFFICIENT_DATA",
      authorizedMetrics: {},
      justification: "Dados formais ainda insuficientes para classificação financeira.",
      evidence: [{ sourceType: "ERP", sourceReference: "Consulta sem movimento", sourceDate: "2025-12-31" }],
      confirmedAt: "2026-07-24T12:00:00.000-03:00",
    });
    expect(parsed.success).toBe(false);
  });
});
