import { randomUUID } from "node:crypto";

import {
  assertOpportunityTransition,
  collectCriticalChanges,
  opportunityCodeSchema,
  opportunityDraftSchema,
  opportunityPatchSchema,
  type OpportunityDraft,
  type OpportunityLifecycleSnapshot,
  type OpportunityStatus,
} from "@/modules/opportunities/domain/opportunity";

export type OpportunityRecord = Readonly<
  OpportunityLifecycleSnapshot & {
    id: string;
    version: number;
    closureReasonCode?: string;
    closureJustification?: string;
  }
>;

export type OpportunityRevision = Readonly<{
  before: OpportunityRecord;
  after: OpportunityRecord;
  action: "UPDATED" | "STATUS_CHANGED";
  changes: Readonly<Record<string, unknown>>;
  reason?: string;
  actorId: string;
  correlationId: string;
}>;

export type DuplicateReview = Readonly<{
  decision: "CREATE_SEPARATE";
  justification: string;
  candidateIds: readonly string[];
}>;

export interface OpportunityRepository {
  create(
    draft: OpportunityDraft,
    actorId: string,
    correlationId: string,
    duplicateReview?: DuplicateReview,
    requestedCode?: string,
  ): Promise<OpportunityRecord>;
  findById(id: string): Promise<OpportunityRecord | null>;
  revise(revision: OpportunityRevision): Promise<OpportunityRecord>;
}

export class OpportunityNotFoundError extends Error {
  constructor(id: string) {
    super(`Oportunidade não encontrada: ${id}`);
    this.name = "OpportunityNotFoundError";
  }
}

export class OpportunityService {
  constructor(private readonly repository: OpportunityRepository) {}

  async create(
    input: unknown,
    actorId: string,
    correlationId: string = randomUUID(),
    duplicateReview?: DuplicateReview,
    requestedCode?: string,
  ): Promise<OpportunityRecord> {
    const draft = opportunityDraftSchema.parse(input);
    const code = requestedCode === undefined ? undefined : opportunityCodeSchema.parse(requestedCode);
    return this.repository.create(draft, actorId, correlationId, duplicateReview, code);
  }

  async update(
    id: string,
    input: unknown,
    actorId: string,
    correlationId: string = randomUUID(),
    duplicateReview?: DuplicateReview,
  ): Promise<OpportunityRecord> {
    const before = await this.requireOpportunity(id);
    const patch = opportunityPatchSchema.parse(input);
    const draft = opportunityDraftSchema.parse({ ...this.toDraft(before), ...patch });
    const after = Object.freeze({ ...before, ...draft, version: before.version + 1 });

    return this.repository.revise({
      before,
      after,
      action: "UPDATED",
      changes: {
        ...collectCriticalChanges(before, after),
        ...(duplicateReview && { duplicateReview }),
      },
      actorId,
      correlationId,
    });
  }

  async transition(
    id: string,
    target: OpportunityStatus,
    actorId: string,
    options: Readonly<{ closureReasonCode?: string; closureJustification?: string; reason?: string; ownerId?: string }> = {},
    correlationId: string = randomUUID(),
  ): Promise<OpportunityRecord> {
    const before = await this.requireOpportunity(id);
    const delegated = options.ownerId ? Object.freeze({ ...before, ownerId: options.ownerId }) : before;
    assertOpportunityTransition(delegated, target, options.closureReasonCode, options.reason);

    const closing = target === "CLOSED";
    const after = Object.freeze({
      ...delegated,
      status: target,
      version: before.version + 1,
      closureReasonCode: closing ? options.closureReasonCode : undefined,
      closureJustification: closing ? options.closureJustification : undefined,
    });

    return this.repository.revise({
      before,
      after,
      action: "STATUS_CHANGED",
      changes: collectCriticalChanges(before, after),
      reason: options.reason,
      actorId,
      correlationId,
    });
  }

  private async requireOpportunity(id: string): Promise<OpportunityRecord> {
    const opportunity = await this.repository.findById(id);
    if (!opportunity) throw new OpportunityNotFoundError(id);
    return opportunity;
  }

  private toDraft(record: OpportunityRecord): OpportunityDraft {
    return {
      origin: record.origin,
      ...(record.subject && { subject: record.subject }),
      ...(record.customerId && { customerId: record.customerId }),
      ...(record.contractingAuthorityId && { contractingAuthorityId: record.contractingAuthorityId }),
      ...(record.estimatedValue !== undefined && { estimatedValue: record.estimatedValue }),
      ...(record.currency && { currency: record.currency }),
      ...(record.valueSource && { valueSource: record.valueSource }),
      ...(record.publishedAt && { publishedAt: record.publishedAt }),
      ...(record.deliveryAt && { deliveryAt: record.deliveryAt }),
      ...(record.datesSource && { datesSource: record.datesSource }),
      ...(record.datesTimeZone && { datesTimeZone: record.datesTimeZone }),
      ...(record.ownerId && { ownerId: record.ownerId }),
    };
  }
}
