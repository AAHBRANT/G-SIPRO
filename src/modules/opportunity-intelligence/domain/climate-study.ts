import { createHash } from "node:crypto";
import { z } from "zod";

import type { CommercialDimensionResult } from "./commercial-preliminary-analysis";

const isoDate = z.iso.date();

export const climateStudyContextSchema = z.object({
  locationLabel: z.string().trim().min(2).max(255),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  workStart: isoDate,
  workEnd: isoDate,
}).refine(value => value.workEnd >= value.workStart, {
  message: "A data final da obra deve ser igual ou posterior à data inicial.",
  path: ["workEnd"],
});

const monthlyClimateSchema = z.object({
  month: z.number().int().min(1).max(12),
  precipitationMm: z.number().nonnegative(),
  averageTemperatureC: z.number().min(-90).max(70).optional(),
  sampleYears: z.number().int().positive(),
  completeness: z.number().min(0).max(100),
});

export const climateApiResponseSchema = z.object({
  provider: z.string().trim().min(1).max(120),
  requestId: z.string().trim().min(1).max(160).optional(),
  retrievedAt: z.iso.datetime({ offset: true }),
  historyStart: isoDate,
  historyEnd: isoDate,
  station: z.object({
    code: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(255),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    distanceKm: z.number().nonnegative().optional(),
  }).optional(),
  monthly: z.array(monthlyClimateSchema).min(1).max(12),
  sourceMetadata: z.record(z.string(), z.unknown()),
}).superRefine((value, context) => {
  if (value.historyEnd < value.historyStart) {
    context.addIssue({ code: "custom", path: ["historyEnd"], message: "Período histórico inválido." });
  }
  if (new Set(value.monthly.map(item => item.month)).size !== value.monthly.length) {
    context.addIssue({ code: "custom", path: ["monthly"], message: "Os meses da série não podem ser duplicados." });
  }
});

export type ClimateStudyContext = z.infer<typeof climateStudyContextSchema>;
export type ClimateApiResponse = z.infer<typeof climateApiResponseSchema>;

export type ClimateStudyCalculation = Readonly<{
  responseHash: string;
  resultHash: string;
  dataCoverage: number;
  projectMonths: readonly number[];
  expectedHistoricalPrecipitationMm: number;
  monthlySeries: ClimateApiResponse["monthly"];
  dimensions: readonly CommercialDimensionResult[];
}>;

const canonicalize = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

const hash = (value: unknown) => createHash("sha256").update(canonicalize(value)).digest("hex");
const round = (value: number) => Math.round(value * 10_000) / 10_000;
const utcDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

function projectMonths(start: string, end: string) {
  const cursor = utcDate(start);
  const limit = utcDate(end);
  const months: number[] = [];
  while (cursor <= limit) {
    months.push(cursor.getUTCMonth() + 1);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
  }
  return months;
}

export function calculateClimateStudy(
  contextInput: ClimateStudyContext,
  responseInput: ClimateApiResponse,
  dimensions: ReadonlyArray<{ code: string }>,
  studiesPerspectiveWeight: number,
): ClimateStudyCalculation {
  const context = climateStudyContextSchema.parse(contextInput);
  const response = climateApiResponseSchema.parse(responseInput);
  if (dimensions.length === 0) throw new Error("A política aprovada não possui dimensão de estudos.");

  const months = projectMonths(context.workStart, context.workEnd);
  const seriesByMonth = new Map(response.monthly.map(item => [item.month, item]));
  const available = months.map(month => seriesByMonth.get(month)).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const dataCoverage = months.length > 0
    ? round(available.reduce((total, item) => total + item.completeness, 0) / months.length)
    : 0;
  const expectedHistoricalPrecipitationMm = round(
    available.reduce((total, item) => total + item.precipitationMm, 0),
  );
  const missingMonths = [...new Set(months.filter(month => !seriesByMonth.has(month)))];
  const pendingItems = [
    ...(missingMonths.length > 0 ? [{
      description: `A API não retornou dados para o(s) mês(es): ${missingMonths.join(", ")}.`,
      reason: "Meses ausentes reduzem a cobertura climática do período da obra.",
      requiredInformation: "Reconsultar a API ou selecionar outra estação autorizada com cobertura adequada.",
    }] : []),
    {
      description: "Regra técnica de impacto na produtividade ainda não aprovada.",
      reason: "Precipitação não pode ser convertida automaticamente em atraso ou nota de praticabilidade.",
      requiredInformation: "Aprovar regra técnica por tipo de serviço antes de pontuar a dimensão.",
    },
  ];
  const dimensionWeight = studiesPerspectiveWeight / dimensions.length;
  const facts = {
    provider: response.provider,
    requestId: response.requestId,
    location: context,
    station: response.station,
    historyStart: response.historyStart,
    historyEnd: response.historyEnd,
    projectMonths: months,
    expectedHistoricalPrecipitationMm,
    dataCoverage,
  };
  const calculations = {
    formula: "Soma das médias históricas mensais correspondentes aos meses previstos da obra.",
    monthlyValues: available.map(item => ({
      month: item.month,
      precipitationMm: item.precipitationMm,
      completeness: item.completeness,
      sampleYears: item.sampleYears,
    })),
  };
  const resultDimensions = dimensions.map<CommercialDimensionResult>(dimension => {
    const partial = {
      perspective: "STUDIES" as const,
      dimension: dimension.code,
      status: "NOT_CALCULABLE" as const,
      weight: round(dimensionWeight),
      confidence: dataCoverage,
      summary: `Exposição histórica de ${expectedHistoricalPrecipitationMm.toFixed(1)} mm no período previsto; sem conversão automática em atraso.`,
      facts,
      calculations,
      inferences: [] as const,
      risks: pendingItems.map(item => item.description),
      method: "climate-api-exposure" as const,
      methodVersion: "1.0.0" as const,
      pendingItems,
    };
    return Object.freeze({ ...partial, resultHash: hash(partial) });
  });
  const responseHash = hash(response);
  const resultHash = hash({ context, responseHash, dataCoverage, expectedHistoricalPrecipitationMm });
  return Object.freeze({
    responseHash,
    resultHash,
    dataCoverage,
    projectMonths: months,
    expectedHistoricalPrecipitationMm,
    monthlySeries: response.monthly,
    dimensions: resultDimensions,
  });
}
