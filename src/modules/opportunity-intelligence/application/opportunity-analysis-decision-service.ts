import { randomUUID } from "node:crypto";

import { z } from "zod";

export const opportunityAnalysisDecisionSchema = z.object({
  decision: z.enum(["PROCEED", "PROCEED_WITH_RESTRICTIONS", "DO_NOT_PROCEED"]),
  justification: z.string().trim().min(20).max(2000),
}).strict();

type Decision = z.infer<typeof opportunityAnalysisDecisionSchema>;

export interface OpportunityAnalysisDecisionRepository {
  findContext(analysisId: string): Promise<{
    recommendation: string | null;
    hasOpenImpediment: boolean;
  } | null>;
  decide(analysisId: string, decision: Decision, actorId: string, correlationId: string): Promise<unknown>;
}

export class OpportunityAnalysisDecisionService {
  constructor(private readonly repository: OpportunityAnalysisDecisionRepository) {}

  findContext(analysisId: string) {
    return this.repository.findContext(analysisId);
  }

  decide(analysisId: string, input: unknown, actorId: string, correlationId: string = randomUUID()) {
    return this.repository.decide(
      analysisId,
      opportunityAnalysisDecisionSchema.parse(input),
      actorId,
      correlationId,
    );
  }
}
