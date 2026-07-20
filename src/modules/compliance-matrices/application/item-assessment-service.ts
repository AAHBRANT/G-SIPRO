import { randomUUID } from "node:crypto";
import { itemAssessmentSchema, type ItemAssessmentDraft } from "@/modules/compliance-matrices/domain/item-assessment";

export type ItemAssessmentRecord = Readonly<{ id: string; matrixItemId: string; version: number; decision: string; evidenceCount: number; validatedAt: Date }>;
export interface ItemAssessmentRepository { validate(matrixItemId: string, draft: ItemAssessmentDraft, actorId: string, correlationId: string): Promise<ItemAssessmentRecord>; }

export class ItemAssessmentService {
  constructor(private readonly repository: ItemAssessmentRepository) {}
  validate(matrixItemId: string, input: unknown, actorId: string, correlationId: string = randomUUID()) { return this.repository.validate(matrixItemId, itemAssessmentSchema.parse(input), actorId, correlationId); }
}

