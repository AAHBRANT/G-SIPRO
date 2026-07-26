import { randomUUID } from "node:crypto";

export interface OpportunityAnalysisRepository {
  runCommercialPreliminary(opportunityId: string, actorId: string, correlationId: string): Promise<unknown>;
  runTechnicalCapacity(opportunityId: string, actorId: string, correlationId: string): Promise<unknown>;
  findLatest(opportunityId: string): Promise<unknown | null>;
  listVersions(opportunityId: string): Promise<readonly unknown[]>;
}

export class OpportunityAnalysisService {
  constructor(private readonly repository: OpportunityAnalysisRepository) {}

  runCommercialPreliminary(
    opportunityId: string,
    actorId: string,
    correlationId: string = randomUUID(),
  ) {
    return this.repository.runCommercialPreliminary(opportunityId, actorId, correlationId);
  }

  runTechnicalCapacity(
    opportunityId: string,
    actorId: string,
    correlationId: string = randomUUID(),
  ) {
    return this.repository.runTechnicalCapacity(opportunityId, actorId, correlationId);
  }

  findLatest(opportunityId: string) {
    return this.repository.findLatest(opportunityId);
  }

  listVersions(opportunityId: string) {
    return this.repository.listVersions(opportunityId);
  }
}
