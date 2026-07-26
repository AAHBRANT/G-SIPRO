import { randomUUID } from "node:crypto";

import { getDatabase } from "@/core/database/prisma";
import { ResourceNotFoundError } from "@/core/errors/application-error";
import type { FinancialAssessmentRepository } from "../application/financial-assessment-service";
import type { calculateFinancialAssessment } from "../domain/financial-assessment";
import type { calculateCustomerPaymentAssessment } from "../domain/customer-payment-assessment";

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as object;

export class PrismaFinancialAssessmentRepository implements FinancialAssessmentRepository {
  async createFinancial(
    opportunityId: string,
    draft: ReturnType<typeof calculateFinancialAssessment>,
    actorId: string,
    correlationId: string,
  ) {
    return getDatabase().$transaction(async transaction => {
      const opportunity = await transaction.opportunity.findUnique({
        where: { id: opportunityId },
        select: { id: true },
      });
      if (!opportunity) throw new ResourceNotFoundError("Oportunidade não encontrada.");
      const replay = await transaction.financialCapacityAssessment.findUnique({
        where: { opportunityId_assessmentHash: { opportunityId, assessmentHash: draft.assessmentHash } },
      });
      if (replay) return replay;
      const latest = await transaction.financialCapacityAssessment.findFirst({
        where: { opportunityId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const record = await transaction.financialCapacityAssessment.create({
        data: {
          id: randomUUID(),
          opportunityId,
          version: (latest?.version ?? 0) + 1,
          periodStart: new Date(`${draft.periodStart}T00:00:00.000Z`),
          periodEnd: new Date(`${draft.periodEnd}T00:00:00.000Z`),
          indices: json(draft.indices),
          calculatedResult: json({
            calculatedIndices: draft.calculatedIndices,
            failedIndexCodes: draft.failedIndexCodes,
            highIndebtednessRisk: draft.highIndebtednessRisk,
          }),
          conclusion: draft.conclusion,
          justification: draft.justification,
          evidence: json(draft.evidence),
          assessmentHash: draft.assessmentHash,
          confirmedAt: new Date(draft.confirmedAt),
          confirmedBy: actorId,
          correlationId,
        },
      });
      await transaction.auditEvent.create({
        data: {
          id: randomUUID(),
          actorType: "USER",
          actorId,
          action: "FINANCIAL_CAPACITY_ASSESSMENT_CONFIRMED",
          entityType: "FINANCIAL_CAPACITY_ASSESSMENT",
          entityId: record.id,
          correlationId,
          outcome: "SUCCESS",
          origin: "opportunity-intelligence",
          metadata: {
            opportunityId,
            version: record.version,
            conclusion: record.conclusion,
            assessmentHash: record.assessmentHash,
          },
        },
      });
      return record;
    });
  }

  listFinancial(opportunityId: string) {
    return getDatabase().financialCapacityAssessment.findMany({
      where: { opportunityId },
      orderBy: { version: "desc" },
    });
  }

  async createPayment(
    draft: ReturnType<typeof calculateCustomerPaymentAssessment>,
    actorId: string,
    correlationId: string,
  ) {
    return getDatabase().$transaction(async transaction => {
      if (draft.customerId) {
        const customer = await transaction.customer.findUnique({ where: { id: draft.customerId }, select: { id: true } });
        if (!customer) throw new ResourceNotFoundError("Cliente não encontrado.");
      } else if (draft.authorityId) {
        const authority = await transaction.contractingAuthority.findUnique({
          where: { id: draft.authorityId },
          select: { id: true },
        });
        if (!authority) throw new ResourceNotFoundError("Órgão contratante não encontrado.");
      }
      const replay = await transaction.customerPaymentAssessment.findUnique({
        where: {
          subjectKey_assessmentHash: {
            subjectKey: draft.subjectKey,
            assessmentHash: draft.assessmentHash,
          },
        },
      });
      if (replay) return replay;
      const latest = await transaction.customerPaymentAssessment.findFirst({
        where: { subjectKey: draft.subjectKey },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const record = await transaction.customerPaymentAssessment.create({
        data: {
          id: randomUUID(),
          customerId: draft.customerId,
          authorityId: draft.authorityId,
          subjectKey: draft.subjectKey,
          version: (latest?.version ?? 0) + 1,
          periodStart: new Date(`${draft.periodStart}T00:00:00.000Z`),
          periodEnd: new Date(`${draft.periodEnd}T00:00:00.000Z`),
          classification: draft.classification,
          authorizedMetrics: json(draft.authorizedMetrics),
          justification: draft.justification,
          evidence: json(draft.evidence),
          assessmentHash: draft.assessmentHash,
          confirmedAt: new Date(draft.confirmedAt),
          confirmedBy: actorId,
          correlationId,
        },
      });
      await transaction.auditEvent.create({
        data: {
          id: randomUUID(),
          actorType: "USER",
          actorId,
          action: "CUSTOMER_PAYMENT_ASSESSMENT_CONFIRMED",
          entityType: "CUSTOMER_PAYMENT_ASSESSMENT",
          entityId: record.id,
          correlationId,
          outcome: "SUCCESS",
          origin: "opportunity-intelligence",
          metadata: {
            subjectKey: record.subjectKey,
            version: record.version,
            classification: record.classification,
            assessmentHash: record.assessmentHash,
          },
        },
      });
      return record;
    });
  }

  listPayment(subject: { customerId?: string; authorityId?: string }) {
    return getDatabase().customerPaymentAssessment.findMany({
      where: subject.customerId
        ? { customerId: subject.customerId }
        : { authorityId: subject.authorityId },
      orderBy: { version: "desc" },
    });
  }
}
