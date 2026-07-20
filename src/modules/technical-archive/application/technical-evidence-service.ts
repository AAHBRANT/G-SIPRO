import { randomUUID } from "node:crypto";
import { technicalEvidenceSchema, type TechnicalEvidenceDraft } from "@/modules/technical-archive/domain/technical-evidence";

export type TechnicalEvidenceRecord = Readonly<{ id: string; type: string; number: string; version: number; status: string }>;

export interface TechnicalEvidenceRepository {
  create(draft: TechnicalEvidenceDraft, actorId: string, correlationId: string): Promise<TechnicalEvidenceRecord>;
}

export class TechnicalEvidenceService {
  constructor(private readonly repository: TechnicalEvidenceRepository) {}

  create(input: unknown, actorId: string, correlationId: string = randomUUID()) {
    return this.repository.create(technicalEvidenceSchema.parse(input), actorId, correlationId);
  }
}
