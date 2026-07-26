import { ConfigurationError } from "@/core/errors/application-error";
import {
  ClimateApiUnavailableError,
  type ClimateApi,
} from "../application/climate-api";
import {
  climateApiResponseSchema,
  climateStudyContextSchema,
  type ClimateStudyContext,
} from "../domain/climate-study";

type ClimateApiConfiguration = Readonly<{
  baseUrl: string;
  token?: string;
  timeoutMs: number;
}>;

function configurationFromEnvironment(): ClimateApiConfiguration {
  const baseUrl = process.env.CLIMATE_API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new ConfigurationError(
      "A API climática ainda não foi configurada.",
      { missing: "CLIMATE_API_BASE_URL" },
    );
  }
  try {
    new URL(baseUrl);
  } catch {
    throw new ConfigurationError("CLIMATE_API_BASE_URL deve ser uma URL válida.");
  }
  const timeout = Number(process.env.CLIMATE_API_TIMEOUT_MS) || 30_000;
  return {
    baseUrl,
    ...(process.env.CLIMATE_API_TOKEN?.trim() && { token: process.env.CLIMATE_API_TOKEN.trim() }),
    timeoutMs: Math.min(Math.max(timeout, 5_000), 120_000),
  };
}

export class HttpClimateApi implements ClimateApi {
  constructor(
    private readonly configuration: ClimateApiConfiguration = configurationFromEnvironment(),
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async collectHistoricalMonthly(contextInput: ClimateStudyContext) {
    const context = climateStudyContextSchema.parse(contextInput);
    const url = new URL(this.configuration.baseUrl);
    url.searchParams.set("latitude", context.latitude.toString());
    url.searchParams.set("longitude", context.longitude.toString());
    url.searchParams.set("aggregation", "monthly");
    url.searchParams.set("history", "longest-reliable");
    url.searchParams.set("variables", "precipitation,temperature");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.configuration.timeoutMs);
    try {
      const response = await this.fetcher(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          ...(this.configuration.token && { authorization: `Bearer ${this.configuration.token}` }),
        },
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        throw new ClimateApiUnavailableError(
          `A API climática respondeu com status ${response.status}.`,
        );
      }
      return climateApiResponseSchema.parse(await response.json());
    } catch (error) {
      if (error instanceof ClimateApiUnavailableError) throw error;
      throw new ClimateApiUnavailableError(
        "Não foi possível obter os dados da API climática.",
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
