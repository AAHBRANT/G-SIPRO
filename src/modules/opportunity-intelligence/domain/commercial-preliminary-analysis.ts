import { createHash } from "node:crypto";
import { z } from "zod";

import {
  intelligenceDimensionSchema,
  intelligenceThresholdsSchema,
  intelligenceWeightsSchema,
} from "./intelligence-policy";

const optionalText = z.string().trim().min(1).optional();

export const commercialOpportunitySnapshotSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  code: z.string().trim().min(1),
  origin: z.string().trim().min(1),
  subject: optionalText,
  customerId: z.uuid().optional(),
  contractingAuthorityId: z.uuid().optional(),
  estimatedValue: z.number().nonnegative().optional(),
  currency: z.string().trim().length(3).optional(),
  valueSource: optionalText,
  publishedAt: z.date().optional(),
  deliveryAt: z.date().optional(),
  datesSource: optionalText,
  datesTimeZone: optionalText,
  ownerId: z.uuid().optional(),
});

export const approvedPolicySnapshotSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  dimensions: z.array(intelligenceDimensionSchema),
  weights: intelligenceWeightsSchema,
  thresholds: intelligenceThresholdsSchema,
  coverageMinimum: z.number().min(0).max(100),
});

export type CommercialOpportunitySnapshot = z.infer<typeof commercialOpportunitySnapshotSchema>;
export type ApprovedPolicySnapshot = z.infer<typeof approvedPolicySnapshotSchema>;

export type CommercialPendingItem = Readonly<{
  description: string;
  reason: string;
  requiredInformation: string;
}>;

export type CommercialDimensionResult = Readonly<{
  perspective: "COMMERCIAL" | "TECHNICAL" | "STUDIES";
  dimension: string;
  status: "CALCULATED" | "NOT_CALCULABLE";
  score?: number;
  weight: number;
  confidence: number;
  summary: string;
  facts: Readonly<Record<string, unknown>>;
  calculations: Readonly<Record<string, unknown>>;
  inferences: readonly string[];
  risks: readonly string[];
  method: "commercial-readiness" | "technical-capacity-matrix" | "climate-api-exposure" | "practicability-climate-logistics";
  methodVersion: "1.0.0";
  resultHash: string;
  pendingItems: readonly CommercialPendingItem[];
}>;

export type CommercialPreliminaryResult = Readonly<{
  inputHash: string;
  score?: number;
  coverage: number;
  confidence: number;
  recommendation: "WAITING_INFORMATION";
  status: "PARTIAL" | "WAITING_INFORMATION";
  executiveSummary: string;
  dimensions: readonly CommercialDimensionResult[];
}>;

const canonicalize = (value: unknown): string => {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
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

function evaluateCommercialReadiness(opportunity: CommercialOpportunitySnapshot) {
  const authorityIdentified = Boolean(opportunity.customerId || opportunity.contractingAuthorityId);
  const checks = [
    { code: "SUBJECT", present: Boolean(opportunity.subject), points: 20 },
    { code: "CUSTOMER_OR_AUTHORITY", present: authorityIdentified, points: 15 },
    { code: "OWNER", present: Boolean(opportunity.ownerId), points: 5 },
    { code: "ESTIMATED_VALUE", present: opportunity.estimatedValue !== undefined, points: 20 },
    { code: "CURRENCY", present: Boolean(opportunity.currency), points: 5 },
    { code: "VALUE_SOURCE", present: Boolean(opportunity.valueSource), points: 10 },
    { code: "DELIVERY_DATE", present: Boolean(opportunity.deliveryAt), points: 15 },
    { code: "DATES_SOURCE", present: Boolean(opportunity.datesSource), points: 5 },
    { code: "DATES_TIME_ZONE", present: Boolean(opportunity.datesTimeZone), points: 5 },
  ] as const;
  const score = checks.reduce((total, check) => total + (check.present ? check.points : 0), 0);
  const materialSignals = [
    Boolean(opportunity.subject),
    authorityIdentified,
    opportunity.estimatedValue !== undefined,
    Boolean(opportunity.deliveryAt),
  ].filter(Boolean).length;

  const pendingItems: CommercialPendingItem[] = [];
  if (!opportunity.subject) {
    pendingItems.push({
      description: "Objeto da oportunidade não informado.",
      reason: "O objeto é necessário para compreender o escopo comercial.",
      requiredInformation: "Informar o objeto ou assunto da oportunidade.",
    });
  }
  if (!authorityIdentified) {
    pendingItems.push({
      description: "Cliente ou órgão contratante não identificado.",
      reason: "Não é possível relacionar histórico e contexto do contratante.",
      requiredInformation: "Vincular o cliente ou o órgão contratante.",
    });
  }
  if (opportunity.estimatedValue === undefined || !opportunity.currency || !opportunity.valueSource) {
    pendingItems.push({
      description: "Informações de valor incompletas.",
      reason: "A avaliação comercial exige valor, moeda e fonte rastreável.",
      requiredInformation: "Completar valor estimado, moeda e fonte do valor.",
    });
  }
  if (!opportunity.deliveryAt || !opportunity.datesSource || !opportunity.datesTimeZone) {
    pendingItems.push({
      description: "Prazo comercial incompleto.",
      reason: "A análise de prazo exige data, fonte e fuso horário.",
      requiredInformation: "Completar a data de entrega, sua fonte e o fuso horário.",
    });
  }

  return {
    calculable: materialSignals >= 2,
    score,
    confidence: score,
    checks,
    pendingItems,
  };
}

export function calculateCommercialPreliminaryAnalysis(
  opportunityInput: CommercialOpportunitySnapshot,
  policyInput: ApprovedPolicySnapshot,
): CommercialPreliminaryResult {
  const opportunity = commercialOpportunitySnapshotSchema.parse(opportunityInput);
  const policy = approvedPolicySnapshotSchema.parse(policyInput);
  const commercialDimensions = policy.dimensions.filter(dimension => dimension.perspective === "COMMERCIAL");
  if (commercialDimensions.length === 0) throw new Error("A política aprovada não possui dimensão comercial.");

  const evaluation = evaluateCommercialReadiness(opportunity);
  const dimensionWeight = policy.weights.commercial / commercialDimensions.length;
  const facts = {
    opportunityCode: opportunity.code,
    origin: opportunity.origin,
    subjectInformed: Boolean(opportunity.subject),
    customerOrAuthorityIdentified: Boolean(opportunity.customerId || opportunity.contractingAuthorityId),
    estimatedValueInformed: opportunity.estimatedValue !== undefined,
    currencyInformed: Boolean(opportunity.currency),
    valueSourceInformed: Boolean(opportunity.valueSource),
    deliveryDateInformed: Boolean(opportunity.deliveryAt),
    datesSourceInformed: Boolean(opportunity.datesSource),
    datesTimeZoneInformed: Boolean(opportunity.datesTimeZone),
  };
  const calculations = {
    rubric: evaluation.checks,
    obtainedPoints: evaluation.score,
    maximumPoints: 100,
  };

  const dimensions = commercialDimensions.map<CommercialDimensionResult>(dimension => {
    const result = {
      perspective: "COMMERCIAL" as const,
      dimension: dimension.code,
      status: evaluation.calculable ? "CALCULATED" as const : "NOT_CALCULABLE" as const,
      ...(evaluation.calculable && { score: evaluation.score }),
      weight: round(dimensionWeight),
      confidence: evaluation.confidence,
      summary: evaluation.calculable
        ? `Completude comercial preliminar de ${evaluation.score.toFixed(0)}%.`
        : "Dados insuficientes para calcular a dimensão comercial.",
      facts,
      calculations,
      inferences: [] as const,
      risks: evaluation.pendingItems.map(item => item.description),
      method: "commercial-readiness" as const,
      methodVersion: "1.0.0" as const,
      pendingItems: evaluation.pendingItems,
    };
    return Object.freeze({ ...result, resultHash: hash(result) });
  });

  const calculable = dimensions.filter(dimension => dimension.status === "CALCULATED");
  const calculatedWeight = calculable.reduce((total, dimension) => total + dimension.weight, 0);
  const score = calculatedWeight > 0
    ? round(calculable.reduce((total, dimension) => total + (dimension.score ?? 0) * dimension.weight, 0) / calculatedWeight)
    : undefined;
  const coverage = round(calculatedWeight);
  const confidence = calculatedWeight > 0
    ? round(calculable.reduce((total, dimension) => total + dimension.confidence * dimension.weight, 0) / calculatedWeight)
    : 0;
  const inputHash = hash({ opportunity, policyId: policy.id, policyVersion: policy.version });
  const pendingCount = new Set(dimensions.flatMap(dimension => dimension.pendingItems.map(item => item.description))).size;

  return Object.freeze({
    inputHash,
    ...(score !== undefined && { score }),
    coverage,
    confidence,
    recommendation: "WAITING_INFORMATION",
    status: evaluation.calculable ? "PARTIAL" : "WAITING_INFORMATION",
    executiveSummary: evaluation.calculable
      ? `Análise comercial preliminar calculada com ${coverage.toFixed(0)}% de cobertura da política. `
        + `Existem ${pendingCount} pendência(s); as perspectivas Técnica e Estudos ainda não foram executadas.`
      : "A análise comercial aguarda informações mínimas da oportunidade.",
    dimensions,
  });
}
