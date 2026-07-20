import { randomUUID } from "node:crypto";
import { archiveSearchSchema, type ArchiveSearchCriteria } from "@/modules/technical-archive/domain/archive-search";

export type ArchiveSearchResult = Readonly<{
  total: number;
  page: number;
  pageSize: number;
  items: ReadonlyArray<{
    serviceId: string;
    discipline: string;
    originalDescription: string;
    characteristics: string;
    quantities: ReadonlyArray<{ value: string; unit: string; source: string }>;
    work: { id: string; name: string; type: string; location: string } | null;
    contract: {
      id: string;
      code: string;
      subject: string;
      contractorName: string;
      status: string;
      startedAt: Date;
      endedAt: Date;
    };
    evidence: { documentTitle: string; version: number; fileHash: string };
  }>;
}>;

export interface ArchiveSearchRepository {
  search(criteria: ArchiveSearchCriteria, actorId: string, correlationId: string): Promise<ArchiveSearchResult>;
}

export class ArchiveSearchService {
  constructor(private readonly repository: ArchiveSearchRepository) {}

  search(input: unknown, actorId: string, correlationId: string = randomUUID()) {
    return this.repository.search(archiveSearchSchema.parse(input), actorId, correlationId);
  }
}

