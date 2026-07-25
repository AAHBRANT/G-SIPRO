import { createHash } from "node:crypto";
import { z } from "zod";

import type { CommercialDimensionResult } from "./commercial-preliminary-analysis";

export const routeDestinationSchema = z.object({
  label: z.string().trim().min(2).max(255),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  travelMode: z.literal("DRIVE").default("DRIVE"),
}).strict();

export const routeBaseSchema = z.object({
  id: z.uuid(),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  locality: z.string().trim().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  version: z.number().int().positive(),
});

const moneySchema = z.object({
  currencyCode: z.string().trim().length(3),
  units: z.string().regex(/^-?\d+$/),
  nanos: z.number().int().min(-999_999_999).max(999_999_999).default(0),
});

export const routeMatrixResponseSchema = z.object({
  provider: z.string().trim().min(1).max(120),
  requestId: z.string().trim().min(1).max(160).optional(),
  retrievedAt: z.iso.datetime({ offset: true }),
  routes: z.array(z.object({
    baseId: z.uuid(),
    condition: z.enum(["ROUTE_EXISTS", "ROUTE_NOT_FOUND"]),
    distanceMeters: z.number().int().nonnegative().optional(),
    durationSeconds: z.number().nonnegative().optional(),
    tolls: z.array(moneySchema).default([]),
  })).min(1),
  sourceMetadata: z.record(z.string(), z.unknown()),
});

export type RouteDestination = z.infer<typeof routeDestinationSchema>;
export type RouteBase = z.infer<typeof routeBaseSchema>;
export type RouteMatrixResponse = z.infer<typeof routeMatrixResponseSchema>;

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

export function calculateRouteStudy(
  destinationInput: RouteDestination,
  basesInput: RouteBase[],
  responseInput: RouteMatrixResponse,
) {
  const destination = routeDestinationSchema.parse(destinationInput);
  const bases = routeBaseSchema.array().min(1).parse(basesInput);
  const response = routeMatrixResponseSchema.parse(responseInput);
  const baseById = new Map(bases.map(base => [base.id, base]));
  const alternatives = response.routes.map(route => {
    const base = baseById.get(route.baseId);
    if (!base) throw new Error("A API retornou uma base que não pertence à consulta.");
    return {
      baseId: base.id,
      baseCode: base.code,
      baseName: base.name,
      baseLocality: base.locality,
      origin: { latitude: base.latitude, longitude: base.longitude },
      condition: route.condition,
      distanceMeters: route.distanceMeters,
      distanceKm: route.distanceMeters === undefined ? undefined : Math.round(route.distanceMeters / 100) / 10,
      durationSeconds: route.durationSeconds,
      durationHours: route.durationSeconds === undefined ? undefined : Math.round(route.durationSeconds / 360) / 10,
      tolls: route.tolls,
    };
  });
  const missingRoutes = alternatives.filter(route => route.condition === "ROUTE_NOT_FOUND").length;
  const pendingItems = [
    ...(missingRoutes > 0 ? [{
      description: `${missingRoutes} base(s) não possuem rota retornada pela API.`,
      reason: "Ausência de rota não pode ser interpretada como distância ou custo zero.",
      requiredInformation: "Revisar coordenadas ou consultar alternativa logística autorizada.",
    }] : []),
    {
      description: "Regra empresarial de seleção da base ainda não aprovada.",
      reason: "Menor distância não representa necessariamente menor custo ou melhor mobilização.",
      requiredInformation: "Definir pesos de custo, tempo, equipe e capacidade de mobilização.",
    },
    {
      description: "Custos internos de mobilização ainda não informados.",
      reason: "A API fornece rota e estimativas externas, mas não conhece os custos operacionais da empresa.",
      requiredInformation: "Cadastrar fórmula e parâmetros internos de mobilização.",
    },
  ];
  const requestHash = hash({ destination, bases });
  const responseHash = hash(response);
  const resultHash = hash({ requestHash, responseHash, alternatives });
  return Object.freeze({
    requestHash,
    responseHash,
    resultHash,
    alternatives,
    selectionStatus: "PENDING_RULE" as const,
    pendingItems,
  });
}

export function mergePracticabilityDimension(
  previous: CommercialDimensionResult,
  route: ReturnType<typeof calculateRouteStudy>,
): CommercialDimensionResult {
  const partial = {
    perspective: "STUDIES" as const,
    dimension: previous.dimension,
    status: "NOT_CALCULABLE" as const,
    weight: previous.weight,
    confidence: previous.confidence,
    summary: `${previous.summary} ${route.alternatives.length} alternativa(s) logística(s) obtida(s) por API, sem seleção automática de base.`,
    facts: { climate: previous.facts, logistics: { alternatives: route.alternatives, selectionStatus: route.selectionStatus } },
    calculations: { climate: previous.calculations, logistics: { requestHash: route.requestHash } },
    inferences: [] as const,
    risks: [...previous.risks, ...route.pendingItems.map(item => item.description)],
    method: "practicability-climate-logistics" as const,
    methodVersion: "1.0.0" as const,
    pendingItems: [...previous.pendingItems, ...route.pendingItems],
  };
  return Object.freeze({ ...partial, resultHash: hash(partial) });
}
