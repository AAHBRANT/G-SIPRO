import { randomUUID } from "node:crypto";

import { getDatabase } from "@/core/database/prisma";
import type { Opportunity as PrismaOpportunity } from "@/generated/prisma/client";
import type {
  OpportunityRecord,
  OpportunityRepository,
  OpportunityRevision,
  DuplicateReview,
} from "@/modules/opportunities/application/opportunity-service";
import type { OpportunityDraft } from "@/modules/opportunities/domain/opportunity";

export class OpportunityConcurrencyError extends Error {
  constructor(id: string) {
    super(`A oportunidade foi alterada por outra operação: ${id}`);
    this.name = "OpportunityConcurrencyError";
  }
}

export class PrismaOpportunityRepository implements OpportunityRepository {
  async create(
    draft: OpportunityDraft,
    actorId: string,
    correlationId: string,
    duplicateReview?: DuplicateReview,
  ): Promise<OpportunityRecord> {
    const database = getDatabase();

    return database.$transaction(async (transaction) => {
      const opportunity = await transaction.opportunity.create({
        data: {
          id: randomUUID(),
          ...this.persistenceFields(draft),
          status: "DRAFT",
          version: 1,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });

      await transaction.opportunityHistory.create({
        data: {
          id: randomUUID(),
          opportunityId: opportunity.id,
          version: 1,
          action: "CREATED",
          toStatus: "DRAFT",
          changes: this.jsonValue({
            code: { from: null, to: opportunity.code },
            status: { from: null, to: "DRAFT" },
            ...(duplicateReview && { duplicateReview }),
          }),
          changedById: actorId,
          correlationId,
        },
      });

      await transaction.auditEvent.create({
        data: {
          id: randomUUID(),
          actorType: "USER",
          actorId,
          action: "OPPORTUNITY_CREATED",
          entityType: "OPPORTUNITY",
          entityId: opportunity.id,
          correlationId,
          outcome: "SUCCESS",
          origin: "opportunity-service",
          metadata: this.jsonValue({ code: opportunity.code, version: 1, ...(duplicateReview && { duplicateReview }) }),
        },
      });

      return this.toRecord(opportunity);
    });
  }

  async findById(id: string): Promise<OpportunityRecord | null> {
    const opportunity = await getDatabase().opportunity.findUnique({ where: { id } });
    return opportunity ? this.toRecord(opportunity) : null;
  }

  async revise(revision: OpportunityRevision): Promise<OpportunityRecord> {
    const database = getDatabase();

    return database.$transaction(async (transaction) => {
      const result = await transaction.opportunity.updateMany({
        where: { id: revision.before.id, version: revision.before.version },
        data: {
          ...this.persistenceFields(revision.after),
          status: revision.after.status,
          closureReasonCode: revision.after.closureReasonCode ?? null,
          closureJustification: revision.after.closureJustification ?? null,
          closedAt: revision.after.status === "CLOSED" ? new Date() : null,
          version: revision.after.version,
          updatedBy: revision.actorId,
        },
      });

      if (result.count !== 1) throw new OpportunityConcurrencyError(revision.before.id);

      await transaction.opportunityHistory.create({
        data: {
          id: randomUUID(),
          opportunityId: revision.before.id,
          version: revision.after.version,
          action: revision.action,
          fromStatus: revision.before.status,
          toStatus: revision.after.status,
          changes: this.jsonValue(revision.changes),
          reason: revision.reason,
          changedById: revision.actorId,
          correlationId: revision.correlationId,
        },
      });

      await transaction.auditEvent.create({
        data: {
          id: randomUUID(),
          actorType: "USER",
          actorId: revision.actorId,
          action: `OPPORTUNITY_${revision.action}`,
          entityType: "OPPORTUNITY",
          entityId: revision.before.id,
          correlationId: revision.correlationId,
          outcome: "SUCCESS",
          origin: "opportunity-service",
          metadata: this.jsonValue({ version: revision.after.version, changes: revision.changes }),
        },
      });

      const saved = await transaction.opportunity.findUniqueOrThrow({ where: { id: revision.before.id } });
      return this.toRecord(saved);
    });
  }

  private persistenceFields(draft: OpportunityDraft) {
    return {
      code: draft.code,
      origin: draft.origin,
      subject: draft.subject ?? null,
      customerId: draft.customerId ?? null,
      contractingAuthorityId: draft.contractingAuthorityId ?? null,
      estimatedValue: draft.estimatedValue ?? null,
      currency: draft.currency ?? null,
      valueSource: draft.valueSource ?? null,
      publishedAt: draft.publishedAt ?? null,
      deliveryAt: draft.deliveryAt ?? null,
      datesSource: draft.datesSource ?? null,
      datesTimeZone: draft.datesTimeZone ?? null,
      ownerId: draft.ownerId ?? null,
    };
  }

  private toRecord(model: PrismaOpportunity): OpportunityRecord {
    return Object.freeze({
      id: model.id,
      code: model.code,
      origin: model.origin,
      status: model.status,
      version: model.version,
      ...(model.subject && { subject: model.subject }),
      ...(model.customerId && { customerId: model.customerId }),
      ...(model.contractingAuthorityId && { contractingAuthorityId: model.contractingAuthorityId }),
      ...(model.estimatedValue !== null && { estimatedValue: Number(model.estimatedValue) }),
      ...(model.currency && { currency: model.currency }),
      ...(model.valueSource && { valueSource: model.valueSource }),
      ...(model.publishedAt && { publishedAt: model.publishedAt }),
      ...(model.deliveryAt && { deliveryAt: model.deliveryAt }),
      ...(model.datesSource && { datesSource: model.datesSource }),
      ...(model.datesTimeZone && { datesTimeZone: model.datesTimeZone }),
      ...(model.ownerId && { ownerId: model.ownerId }),
      ...(model.closureReasonCode && { closureReasonCode: model.closureReasonCode }),
      ...(model.closureJustification && { closureJustification: model.closureJustification }),
    });
  }

  private jsonValue(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as object;
  }
}
