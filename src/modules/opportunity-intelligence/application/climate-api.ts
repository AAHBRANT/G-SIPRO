import type { ClimateApiResponse, ClimateStudyContext } from "../domain/climate-study";

export interface ClimateApi {
  collectHistoricalMonthly(context: ClimateStudyContext): Promise<ClimateApiResponse>;
}

export class ClimateApiUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ClimateApiUnavailableError";
  }
}
