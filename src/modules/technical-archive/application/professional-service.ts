import { randomUUID } from "node:crypto";
import { professionalSchema, type ProfessionalDraft } from "@/modules/technical-archive/domain/professional";

export type ProfessionalRecord = Readonly<{ id: string; fullName: string; council: string; registrationNumber: string; status: string; version: number; links: number }>;
export type ProfessionalSummary = Readonly<{ id: string; fullName: string; council: string; registrationNumber: string; nationalRegistration: string | null; professionalTitle: string; status: string; classification: string; processingPurpose: string; legalBasis: string; links: readonly Readonly<{ id: string; targetType: string; targetLabel: string; role: string; responsibility: string; startedAt: Date; endedAt: Date; source: string; documentLabel: string }>[] }>;

export interface ProfessionalRepository {
  create(draft: ProfessionalDraft, actorId: string, correlationId: string): Promise<ProfessionalRecord>;
  list(actorId: string, correlationId: string): Promise<readonly ProfessionalSummary[]>;
}

export class ProfessionalService {
  constructor(private readonly repository: ProfessionalRepository) {}
  create(input: unknown, actorId: string, correlationId: string = randomUUID()) { return this.repository.create(professionalSchema.parse(input), actorId, correlationId); }
  list(actorId: string, correlationId: string = randomUUID()) { return this.repository.list(actorId, correlationId); }
}
