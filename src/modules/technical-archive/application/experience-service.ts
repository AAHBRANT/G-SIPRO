import { randomUUID } from "node:crypto";
import { experienceSchema, type ExperienceDraft } from "@/modules/technical-archive/domain/experience";

export type ExperienceRecord = Readonly<{ id: string; code: string; status: string; version: number; works: number; services: number; quantities: number }>;
export interface ExperienceRepository { create(draft: ExperienceDraft, actorId: string, correlationId: string): Promise<ExperienceRecord>; }
export class ExperienceService {
  constructor(private readonly repository: ExperienceRepository) {}
  create(input: unknown, actorId: string, correlationId: string = randomUUID()) { return this.repository.create(experienceSchema.parse(input), actorId, correlationId); }
}
