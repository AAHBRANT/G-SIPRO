import type { IntelligenceRecommendation, OpportunityAnalysisStatus } from "@/generated/prisma/client";
import type { CommercialDimensionResult } from "./commercial-preliminary-analysis";

export type AnalysisConsolidation = Readonly<{
  score?: number;
  coverage: number;
  confidence: number;
  recommendation: IntelligenceRecommendation;
  status: OpportunityAnalysisStatus;
}>;

const round = (value: number) => Math.round(value * 10_000) / 10_000;

export function consolidateAnalysis(
  dimensions: readonly CommercialDimensionResult[],
  policy: {
    coverageMinimum: number;
    thresholds: {
      recommendedMinimum: number;
      restrictionsMinimum: number;
      minimumConfidence: number;
    };
  },
  constraints: { hasCriticalFailure: boolean; hasUnresolvedCritical: boolean },
): AnalysisConsolidation {
  const calculable = dimensions.filter(dimension => dimension.status === "CALCULATED");
  const coverage = round(calculable.reduce((total, dimension) => total + dimension.weight, 0));
  const score = coverage > 0
    ? round(calculable.reduce((total, dimension) => total + (dimension.score ?? 0) * dimension.weight, 0) / coverage)
    : undefined;
  const confidence = coverage > 0
    ? round(calculable.reduce((total, dimension) => total + dimension.confidence * dimension.weight, 0) / coverage)
    : 0;

  if (constraints.hasCriticalFailure) {
    return { score, coverage, confidence, recommendation: "NOT_RECOMMENDED", status: "SUCCEEDED" };
  }
  if (
    constraints.hasUnresolvedCritical
    || coverage < policy.coverageMinimum
    || confidence < policy.thresholds.minimumConfidence
  ) {
    return {
      score,
      coverage,
      confidence,
      recommendation: "WAITING_INFORMATION",
      status: coverage > 0 ? "PARTIAL" : "WAITING_INFORMATION",
    };
  }
  if ((score ?? 0) >= policy.thresholds.recommendedMinimum) {
    return { score, coverage, confidence, recommendation: "RECOMMENDED", status: "SUCCEEDED" };
  }
  if ((score ?? 0) >= policy.thresholds.restrictionsMinimum) {
    return { score, coverage, confidence, recommendation: "RECOMMENDED_WITH_RESTRICTIONS", status: "SUCCEEDED" };
  }
  return { score, coverage, confidence, recommendation: "NOT_RECOMMENDED", status: "SUCCEEDED" };
}
