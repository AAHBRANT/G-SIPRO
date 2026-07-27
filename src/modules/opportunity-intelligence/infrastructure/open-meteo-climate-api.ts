import { z } from "zod";
import { Agent } from "undici";

import { ClimateApiUnavailableError, type ClimateApi } from "../application/climate-api";
import {
  climateStudyContextSchema,
  type ClimateApiResponse,
  type ClimateStudyContext,
} from "../domain/climate-study";

// O undici (cliente HTTP por trás do fetch nativo do Node) tem um timeout de
// conexão padrão de só 10s, separado do timeout geral da requisição — mais
// curto do que o necessário pra alcançar a archive-api.open-meteo.com a
// partir do Azure em alguns momentos, mesmo dentro do timeout configurado
// (CLIMATE_API_TIMEOUT_MS). Um dispatcher próprio evita esse limite oculto.
const openMeteoDispatcher = new Agent({ connect: { timeout: 30_000 } });

/**
 * Adaptador para a Open-Meteo Historical Weather API (archive-api.open-meteo.com).
 * Escolhida por ser gratuita e não exigir cadastro nem chave de API — evita a
 * necessidade de criar conta em serviço externo só para o estudo de praticabilidade.
 * Diferente do HttpClimateApi genérico (que espera um provedor já entregando
 * normais mensais prontas), esta classe consulta dados DIÁRIOS de um período
 * histórico e calcula as médias mensais aqui mesmo.
 */

type OpenMeteoConfiguration = Readonly<{
  baseUrl: string;
  historyYears: number;
  timeoutMs: number;
}>;

function configurationFromEnvironment(): OpenMeteoConfiguration {
  const baseUrl = process.env.CLIMATE_API_BASE_URL?.trim() || "https://archive-api.open-meteo.com/v1/archive";
  const historyYears = Number(process.env.CLIMATE_API_HISTORY_YEARS) || 20;
  const timeout = Number(process.env.CLIMATE_API_TIMEOUT_MS) || 30_000;
  return {
    baseUrl,
    historyYears: Math.min(Math.max(historyYears, 5), 40),
    timeoutMs: Math.min(Math.max(timeout, 5_000), 120_000),
  };
}

const dailyResponseSchema = z.object({
  daily: z.object({
    time: z.array(z.string()),
    precipitation_sum: z.array(z.number().nullable()),
    temperature_2m_mean: z.array(z.number().nullable()),
  }),
});

type MonthAccumulator = {
  yearlyTotals: Map<number, number>;
  temperatureSum: number;
  temperatureCount: number;
  expectedDays: number;
  precipitationDays: number;
};

function emptyAccumulator(): MonthAccumulator {
  return { yearlyTotals: new Map(), temperatureSum: 0, temperatureCount: 0, expectedDays: 0, precipitationDays: 0 };
}

export class OpenMeteoClimateApi implements ClimateApi {
  constructor(
    private readonly configuration: OpenMeteoConfiguration = configurationFromEnvironment(),
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async collectHistoricalMonthly(contextInput: ClimateStudyContext): Promise<ClimateApiResponse> {
    const context = climateStudyContextSchema.parse(contextInput);

    const currentYear = new Date().getUTCFullYear();
    const historyEndYear = currentYear - 1;
    const historyStartYear = historyEndYear - this.configuration.historyYears + 1;
    const historyStart = `${historyStartYear}-01-01`;
    const historyEnd = `${historyEndYear}-12-31`;

    const url = new URL(this.configuration.baseUrl);
    url.searchParams.set("latitude", context.latitude.toString());
    url.searchParams.set("longitude", context.longitude.toString());
    url.searchParams.set("start_date", historyStart);
    url.searchParams.set("end_date", historyEnd);
    url.searchParams.set("daily", "precipitation_sum,temperature_2m_mean");
    url.searchParams.set("timezone", "UTC");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.configuration.timeoutMs);
    try {
      const response = await this.fetcher(url, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
        dispatcher: openMeteoDispatcher,
      } as RequestInit & { dispatcher: Agent });
      if (!response.ok) {
        throw new ClimateApiUnavailableError(`A Open-Meteo respondeu com status ${response.status}.`);
      }
      const raw = dailyResponseSchema.parse(await response.json());
      const monthly = this.aggregateByMonth(raw.daily);

      return {
        provider: "Open-Meteo (archive-api.open-meteo.com)",
        retrievedAt: new Date().toISOString(),
        historyStart,
        historyEnd,
        monthly,
        sourceMetadata: {
          source: "open-meteo-historical-weather-api",
          reanalysisModel: "ERA5 / ERA5-Land / CERRA (melhor disponível por local)",
          historyYears: this.configuration.historyYears,
        },
      };
    } catch (error) {
      if (error instanceof ClimateApiUnavailableError) throw error;
      throw new ClimateApiUnavailableError("Não foi possível obter os dados da Open-Meteo.", { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  private aggregateByMonth(daily: {
    time: string[];
    precipitation_sum: (number | null)[];
    temperature_2m_mean: (number | null)[];
  }): ClimateApiResponse["monthly"] {
    const accumulators = new Map<number, MonthAccumulator>();
    for (let month = 1; month <= 12; month += 1) accumulators.set(month, emptyAccumulator());

    daily.time.forEach((isoDate, index) => {
      const date = new Date(`${isoDate}T00:00:00.000Z`);
      const month = date.getUTCMonth() + 1;
      const year = date.getUTCFullYear();
      const accumulator = accumulators.get(month)!;
      accumulator.expectedDays += 1;

      const precipitation = daily.precipitation_sum[index];
      if (precipitation !== null && precipitation !== undefined) {
        accumulator.precipitationDays += 1;
        accumulator.yearlyTotals.set(year, (accumulator.yearlyTotals.get(year) ?? 0) + precipitation);
      }

      const temperature = daily.temperature_2m_mean[index];
      if (temperature !== null && temperature !== undefined) {
        accumulator.temperatureSum += temperature;
        accumulator.temperatureCount += 1;
      }
    });

    return Array.from(accumulators.entries())
      .filter(([, accumulator]) => accumulator.yearlyTotals.size > 0)
      .map(([month, accumulator]) => {
        const sampleYears = accumulator.yearlyTotals.size;
        const precipitationMm = Math.round(
          (Array.from(accumulator.yearlyTotals.values()).reduce((sum, value) => sum + value, 0) / sampleYears) * 10,
        ) / 10;
        const completeness = accumulator.expectedDays > 0
          ? Math.round((accumulator.precipitationDays / accumulator.expectedDays) * 1000) / 10
          : 0;
        return {
          month,
          precipitationMm,
          ...(accumulator.temperatureCount > 0 && {
            averageTemperatureC: Math.round((accumulator.temperatureSum / accumulator.temperatureCount) * 10) / 10,
          }),
          sampleYears,
          completeness,
        };
      });
  }
}
