import { randomUUID } from "node:crypto";

export interface FinancialAnalysisRepository {
  run(opportunityId: string, actorId: string, correlationId: string): Promise<unknown>;
}

export class FinancialAnalysisService {
  constructor(private readonly repository: FinancialAnalysisRepository) {}

  run(opportunityId: string, actorId: string, correlationId: string = randomUUID()) {
    return this.repository.run(opportunityId, actorId, correlationId);
  }
}
