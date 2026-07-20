import { randomUUID } from "node:crypto";
import { z } from "zod";

import { tenderSchema, tenderVersionSchema, type TenderDraft, type TenderVersionDraft } from "@/modules/tenders/domain/tender";

const createTenderSchema = z.object({ tender: tenderSchema, version: tenderVersionSchema });

export type TenderRecord = Readonly<{ id: string; code: string; number: string; version: number }>;

export interface TenderRepository {
  create(tender: TenderDraft, version: TenderVersionDraft, actorId: string, correlationId: string): Promise<TenderRecord>;
  addVersion(tenderId: string, version: TenderVersionDraft, actorId: string, correlationId: string): Promise<TenderRecord>;
}

export class TenderService {
  constructor(private readonly repository: TenderRepository) {}

  async create(input: unknown, actorId: string, correlationId: string = randomUUID()) {
    const parsed = createTenderSchema.parse(input);
    return this.repository.create(parsed.tender, parsed.version, actorId, correlationId);
  }

  async addVersion(tenderId: string, input: unknown, actorId: string, correlationId: string = randomUUID()) {
    return this.repository.addVersion(z.uuid().parse(tenderId), tenderVersionSchema.parse(input), actorId, correlationId);
  }
}
