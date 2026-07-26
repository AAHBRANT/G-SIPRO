import { randomUUID } from "node:crypto";

import {
  calculateFinancialAssessment,
  financialAssessmentDraftSchema,
  type FinancialAssessmentDraft,
} from "../domain/financial-assessment";
import {
  calculateCustomerPaymentAssessment,
  customerPaymentAssessmentDraftSchema,
  type CustomerPaymentAssessmentDraft,
} from "../domain/customer-payment-assessment";

export interface FinancialAssessmentRepository {
  createFinancial(
    opportunityId: string,
    draft: ReturnType<typeof calculateFinancialAssessment>,
    actorId: string,
    correlationId: string,
  ): Promise<unknown>;
  listFinancial(opportunityId: string): Promise<readonly unknown[]>;
  createPayment(
    draft: ReturnType<typeof calculateCustomerPaymentAssessment>,
    actorId: string,
    correlationId: string,
  ): Promise<unknown>;
  listPayment(subject: { customerId?: string; authorityId?: string }): Promise<readonly unknown[]>;
}

export class FinancialAssessmentService {
  constructor(private readonly repository: FinancialAssessmentRepository) {}

  createFinancial(
    opportunityId: string,
    input: unknown,
    actorId: string,
    correlationId: string = randomUUID(),
  ) {
    const draft: FinancialAssessmentDraft = financialAssessmentDraftSchema.parse(input);
    return this.repository.createFinancial(
      opportunityId,
      calculateFinancialAssessment(draft),
      actorId,
      correlationId,
    );
  }

  listFinancial(opportunityId: string) {
    return this.repository.listFinancial(opportunityId);
  }

  createPayment(input: unknown, actorId: string, correlationId: string = randomUUID()) {
    const draft: CustomerPaymentAssessmentDraft = customerPaymentAssessmentDraftSchema.parse(input);
    return this.repository.createPayment(
      calculateCustomerPaymentAssessment(draft),
      actorId,
      correlationId,
    );
  }

  listPayment(subject: { customerId?: string; authorityId?: string }) {
    return this.repository.listPayment(subject);
  }
}
