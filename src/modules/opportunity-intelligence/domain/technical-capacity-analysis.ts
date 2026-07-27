import { createHash } from "node:crypto";
import { z } from "zod";

import type {
  CommercialDimensionResult,
  CommercialPendingItem,
} from "./commercial-preliminary-analysis";

const assessmentSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  decision: z.enum(["MEETS", "PARTIAL", "DOES_NOT_MEET", "NOT_APPLICABLE"]),
  justification: z.string().trim().min(1),
  evidenceCount: z.number().int().nonnegative(),
  validatedAt: z.date(),
});

const matrixItemSchema = z.object({
  id: z.uuid(),
  requirementId: z.uuid(),
  requirementVersion: z.number().int().positive(),
  requirementText: z.string().trim().min(1),
  criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  sourcePage: z.number().int().positive(),
  assessment: assessmentSchema.optional(),
});

export const technicalCapacitySnapshotSchema = z.object({
  tenderVersionId: z.uuid().optional(),
  tenderVersion: z.number().int().positive().optional(),
  tenderFileHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  matrixId: z.uuid().optional(),
  matrixVersion: z.number().int().positive().optional(),
  matrixStatus: z.enum(["IN_ANALYSIS", "VALIDATED", "SUPERSEDED"]).optional(),
  items: z.array(matrixItemSchema),
});

export type TechnicalCapacitySnapshot = z.infer<typeof technicalCapacitySnapshotSchema>;

export type TechnicalCapacityResult = Readonly<{
  inputHash: string;
  score?: number;
  confidence: number;
  hasCriticalFailure: boolean;
  hasUnresolvedCritical: boolean;
  assessedRequirements: number;
  totalRequirements: number;
  dimensions: readonly CommercialDimensionResult[];
}>;

const criticalityWeight = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 } as const;
const decisionScore = { MEETS: 100, PARTIAL: 50, DOES_NOT_MEET: 0 } as const;

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

export function calculateTechnicalCapacity(
  snapshotInput: TechnicalCapacitySnapshot,
  dimensionsInput: ReadonlyArray<{ code: string }>,
  technicalPerspectiveWeight: number,
): TechnicalCapacityResult {
  const snapshot = technicalCapacitySnapshotSchema.parse(snapshotInput);
  if (dimensionsInput.length === 0) throw new Error("A política aprovada não possui dimensão técnica.");
  const applicableItems = snapshot.items.filter(item => item.assessment?.decision !== "NOT_APPLICABLE");
  const assessedItems = applicableItems.filter(item => item.assessment);
  const denominator = applicableItems.reduce((total, item) => total + criticalityWeight[item.criticality], 0);
  const assessedWeight = assessedItems.reduce((total, item) => total + criticalityWeight[item.criticality], 0);
  const score = assessedWeight > 0
    ? round(assessedItems.reduce((total, item) => {
      const decision = item.assessment?.decision;
      return total + criticalityWeight[item.criticality] * (decision ? decisionScore[decision as keyof typeof decisionScore] : 0);
    }, 0) / assessedWeight)
    : undefined;
  const assessmentCoverage = denominator > 0 ? round(assessedWeight * 100 / denominator) : 0;
  const evidenceQuality = assessedItems.length > 0
    ? round(assessedItems.reduce((total, item) => {
      const assessment = item.assessment;
      return total + (assessment?.decision === "DOES_NOT_MEET" || (assessment?.evidenceCount ?? 0) > 0 ? 100 : 50);
    }, 0) / assessedItems.length)
    : 0;
  const confidence = round(assessmentCoverage * evidenceQuality / 100);
  const criticalItems = applicableItems.filter(item => item.criticality === "CRITICAL");
  const hasCriticalFailure = criticalItems.some(item => item.assessment?.decision === "DOES_NOT_MEET");
  const hasUnresolvedCritical = criticalItems.some(
    item => !item.assessment || item.assessment.decision === "PARTIAL",
  );

  const commonPending: CommercialPendingItem[] = [];
  if (!snapshot.matrixId) {
    commonPending.push({
      description: "Matriz de atendimento não localizada.",
      reason: "A capacidade operacional deve ser demonstrada por requisitos e evidências rastreáveis.",
      requiredInformation: "Criar e validar a matriz de atendimento da versão vigente do edital.",
    });
  } else {
    const missingAssessments = applicableItems.filter(item => !item.assessment).length;
    if (missingAssessments > 0) {
      commonPending.push({
        description: `${missingAssessments} requisito(s) ainda sem avaliação.`,
        reason: "Requisitos sem parecer não podem ser presumidos como atendidos.",
        requiredInformation: "Concluir os pareceres pendentes na matriz de atendimento.",
      });
    }
    if (hasUnresolvedCritical) {
      commonPending.push({
        description: "Existem requisitos críticos ainda não comprovados integralmente.",
        reason: "Todos os requisitos críticos devem ser atendidos, independentemente da pontuação.",
        requiredInformation: "Complementar e validar as evidências dos requisitos críticos.",
      });
    }
  }

  const dimensionWeight = technicalPerspectiveWeight / dimensionsInput.length;
  const facts = {
    tenderVersionId: snapshot.tenderVersionId,
    tenderVersion: snapshot.tenderVersion,
    matrixId: snapshot.matrixId,
    matrixVersion: snapshot.matrixVersion,
    matrixStatus: snapshot.matrixStatus,
    totalRequirements: applicableItems.length,
    assessedRequirements: assessedItems.length,
    criticalRequirements: criticalItems.length,
    criticalFailures: criticalItems.filter(item => item.assessment?.decision === "DOES_NOT_MEET").length,
    unresolvedCriticalRequirements: criticalItems.filter(
      item => !item.assessment || item.assessment.decision === "PARTIAL",
    ).length,
    metRequirements: assessedItems.filter(item => item.assessment?.decision === "MEETS").length,
    partialRequirements: assessedItems.filter(item => item.assessment?.decision === "PARTIAL").length,
    unmetRequirements: assessedItems.filter(item => item.assessment?.decision === "DOES_NOT_MEET").length,
  };
  const calculations = {
    criticalityWeights: criticalityWeight,
    decisionScores: decisionScore,
    assessedWeight,
    totalWeight: denominator,
    assessmentCoverage,
    evidenceQuality,
  };
  const risks = [
    ...(hasCriticalFailure ? ["Requisito crítico classificado como não atendido."] : []),
    ...(hasUnresolvedCritical ? ["Requisito crítico ainda sem comprovação integral."] : []),
    ...commonPending.map(item => item.description),
  ];
  const calculable = assessedItems.length > 0;
  const dimensions = dimensionsInput.map<CommercialDimensionResult>(dimension => {
    const result = {
      perspective: "TECHNICAL" as const,
      dimension: dimension.code,
      status: calculable ? "CALCULATED" as const : "NOT_CALCULABLE" as const,
      ...(score !== undefined && { score }),
      weight: round(dimensionWeight),
      confidence,
      summary: calculable
        ? `Capacidade técnica avaliada em ${score?.toFixed(0)}%, com ${assessmentCoverage.toFixed(0)}% dos requisitos ponderados analisados.`
        : "A capacidade técnica aguarda matriz e pareceres rastreáveis.",
      facts,
      calculations,
      inferences: [] as const,
      risks,
      method: "technical-capacity-matrix" as const,
      methodVersion: "1.0.0" as const,
      pendingItems: commonPending,
    };
    return Object.freeze({ ...result, resultHash: hash(result) });
  });

  return Object.freeze({
    inputHash: hash(snapshot),
    ...(score !== undefined && { score }),
    confidence,
    hasCriticalFailure,
    hasUnresolvedCritical,
    assessedRequirements: assessedItems.length,
    totalRequirements: applicableItems.length,
    dimensions,
  });
}
