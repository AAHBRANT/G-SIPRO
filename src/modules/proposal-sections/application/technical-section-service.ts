import { randomUUID } from "node:crypto";
import { technicalSectionDraftSchema, technicalSectionUpdateSchema, type TechnicalSectionDraft, type TechnicalSectionUpdate } from "@/modules/proposal-sections/domain/technical-section";

export type TechnicalSectionRecord = Readonly<{ id: string; componentId: string; type: string; title: string; position: number; status: string; version: number; responsible: { id: string; name: string }; requirements: ReadonlyArray<{ id: string; version: number; type: string; text: string; sourcePage: number }>; createdAt: Date; updatedAt: Date }>;
export interface TechnicalSectionRepository {
  create(proposalId: string, draft: TechnicalSectionDraft, actorId: string, correlationId: string): Promise<TechnicalSectionRecord>;
  update(proposalId: string, sectionId: string, draft: TechnicalSectionUpdate, actorId: string, correlationId: string): Promise<TechnicalSectionRecord>;
}
export class TechnicalSectionService {
  constructor(private readonly repository: TechnicalSectionRepository) {}
  create(proposalId: string, input: unknown, actorId: string, correlationId: string = randomUUID()) { return this.repository.create(proposalId, technicalSectionDraftSchema.parse(input), actorId, correlationId); }
  update(proposalId: string, sectionId: string, input: unknown, actorId: string, correlationId: string = randomUUID()) { return this.repository.update(proposalId, sectionId, technicalSectionUpdateSchema.parse(input), actorId, correlationId); }
}
