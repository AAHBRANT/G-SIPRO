import { randomUUID } from "node:crypto";

import type { ClimateApi } from "./climate-api";
import {
  climateStudyContextSchema,
  type ClimateApiResponse,
  type ClimateStudyContext,
} from "../domain/climate-study";

export interface ClimateStudyRepository {
  recordClimateStudy(
    opportunityId: string,
    context: ClimateStudyContext,
    response: ClimateApiResponse,
    actorId: string,
    correlationId: string,
  ): Promise<unknown>;
  findClimateStudy(analysisId: string): Promise<unknown | null>;
}

export class ClimateStudyService {
  constructor(
    private readonly repository: ClimateStudyRepository,
    private readonly climateApi?: ClimateApi,
  ) {}

  async run(
    opportunityId: string,
    contextInput: unknown,
    actorId: string,
    correlationId: string = randomUUID(),
  ) {
    const context = climateStudyContextSchema.parse(contextInput);
    if (!this.climateApi) throw new Error("API climática obrigatória para executar a coleta.");
    const response = await this.climateApi.collectHistoricalMonthly(context);
    return this.repository.recordClimateStudy(opportunityId, context, response, actorId, correlationId);
  }

  find(analysisId: string) {
    return this.repository.findClimateStudy(analysisId);
  }
}
