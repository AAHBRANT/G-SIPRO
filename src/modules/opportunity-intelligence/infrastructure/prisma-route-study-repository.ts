import { createHash, randomUUID } from "node:crypto";

import { getDatabase } from "@/core/database/prisma";
import type { RouteDetail } from "../application/route-api";
import { RouteStudyRuleError, type RouteStudyRepository } from "../application/route-study-service";
import { consolidateAnalysis } from "../domain/analysis-consolidation";
import type { CommercialDimensionResult } from "../domain/commercial-preliminary-analysis";
import {
  approvedPolicySnapshotSchema,
} from "../domain/commercial-preliminary-analysis";
import {
  intelligenceDimensionSchema,
  intelligenceThresholdsSchema,
  intelligenceWeightsSchema,
} from "../domain/intelligence-policy";
import {
  calculateRouteStudy,
  mergePracticabilityDimension,
  type RouteBase,
  type RouteDestination,
  type RouteMatrixResponse,
} from "../domain/route-study";
import { planAnalysisNotifications } from "../domain/intelligence-notification";
import { enqueueIntelligenceNotifications } from "./prisma-notification-outbox";

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as object;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export class PrismaRouteStudyRepository implements RouteStudyRepository {
  async listActiveRouteBases(): Promise<RouteBase[]> {
    const bases = await getDatabase().operationalBase.findMany({
      where: { active: true },
      orderBy: [{ name: "asc" }, { code: "asc" }],
    });
    return bases.map(base => ({
      id: base.id,
      code: base.code,
      name: base.name,
      locality: base.locality,
      latitude: Number(base.latitude),
      longitude: Number(base.longitude),
      version: base.version,
    }));
  }

  async recordRouteStudy(
    opportunityId: string,
    destination: RouteDestination,
    bases: RouteBase[],
    response: RouteMatrixResponse,
    actorId: string,
    correlationId: string,
  ) {
    return getDatabase().$transaction(async transaction => {
      const previous = await transaction.opportunityAnalysis.findFirst({
        where: { opportunityId },
        orderBy: { version: "desc" },
        include: {
          policy: true,
          climateStudy: true,
          opportunity: { select: { code: true, ownerId: true } },
          dimensions: {
            orderBy: [{ perspective: "asc" }, { dimension: "asc" }],
            include: {
              pendingItems: { where: { status: "OPEN" }, orderBy: { createdAt: "asc" } },
              evidences: { orderBy: { obtainedAt: "asc" } },
            },
          },
        },
      });
      if (!previous?.climateStudy) {
        throw new RouteStudyRuleError("Execute o estudo climático antes da análise logística.");
      }
      const studyDimensionRecord = previous.dimensions.find(item => item.perspective === "STUDIES");
      if (!studyDimensionRecord) {
        throw new RouteStudyRuleError("Dimensão de estudos não encontrada na análise anterior.");
      }
      const policyDimensions = intelligenceDimensionSchema.array().parse(previous.policy.dimensions);
      const policy = approvedPolicySnapshotSchema.parse({
        id: previous.policy.id,
        version: previous.policy.version,
        dimensions: policyDimensions,
        weights: intelligenceWeightsSchema.parse(previous.policy.weights),
        thresholds: intelligenceThresholdsSchema.parse(previous.policy.thresholds),
        coverageMinimum: Number(previous.policy.coverageMinimum),
      });
      const route = calculateRouteStudy(destination, bases, response);
      const previousDimensions = previous.dimensions.map(dimension => this.toDomainDimension(dimension));
      const previousStudy = previousDimensions.find(item => item.perspective === "STUDIES")!;
      const mergedStudy = mergePracticabilityDimension(previousStudy, route);
      const allDimensions = [
        ...previousDimensions.filter(item => item.perspective !== "STUDIES"),
        mergedStudy,
      ];
      const technicalFacts = previous.dimensions.find(
        dimension => dimension.perspective === "TECHNICAL",
      )?.facts as { criticalFailures?: number; unresolvedCriticalRequirements?: number } | undefined;
      const consolidated = consolidateAnalysis(allDimensions, policy, {
        hasCriticalFailure: (technicalFacts?.criticalFailures ?? 0) > 0,
        hasUnresolvedCritical: (technicalFacts?.unresolvedCriticalRequirements ?? 0) > 0,
      });
      const inputHash = hash({
        previousInputHash: previous.inputHash,
        routeResultHash: route.resultHash,
        policyId: previous.policyId,
      });
      const replay = await transaction.opportunityAnalysis.findUnique({
        where: {
          opportunityId_policyId_inputHash: {
            opportunityId,
            policyId: previous.policyId,
            inputHash,
          },
        },
        include: { routeStudy: { include: { details: true } }, climateStudy: true, dimensions: true },
      });
      if (replay) return replay;

      const analysis = await transaction.opportunityAnalysis.create({
        data: {
          id: randomUUID(),
          opportunityId,
          policyId: previous.policyId,
          version: previous.version + 1,
          type: "ENRICHED",
          status: consolidated.status,
          inputHash,
          score: consolidated.score,
          coverage: consolidated.coverage,
          confidence: consolidated.confidence,
          recommendation: consolidated.recommendation,
          executiveSummary: `${previous.executiveSummary ?? "Análise anterior preservada"} `
            + `${route.alternatives.length} alternativa(s) logística(s) consultada(s) via Google Routes API. `
            + "A melhor base não foi selecionada porque a regra de custo, equipe e mobilização ainda depende de aprovação.",
          requestedBy: actorId,
          startedAt: new Date(),
          completedAt: new Date(),
          correlationId,
        },
      });

      for (const dimension of allDimensions) {
        const dimensionRecord = await transaction.analysisDimensionResult.create({
          data: {
            id: randomUUID(),
            analysisId: analysis.id,
            perspective: dimension.perspective,
            dimension: dimension.dimension,
            status: dimension.status,
            score: dimension.score,
            weight: dimension.weight,
            confidence: dimension.confidence,
            summary: dimension.summary,
            facts: json(dimension.facts),
            calculations: json(dimension.calculations),
            inferences: json(dimension.inferences),
            risks: json(dimension.risks),
            method: dimension.method,
            methodVersion: dimension.methodVersion,
            resultHash: dimension.resultHash,
          },
        });
        const priorRecord = previous.dimensions.find(item =>
          item.perspective === dimension.perspective && item.dimension === dimension.dimension
        );
        for (const evidence of priorRecord?.evidences ?? []) {
          await transaction.analysisEvidence.create({
            data: {
              id: randomUUID(),
              analysisId: analysis.id,
              dimensionResultId: dimensionRecord.id,
              sourceType: evidence.sourceType,
              sourceId: evidence.sourceId,
              sourceVersion: evidence.sourceVersion,
              sourceHash: evidence.sourceHash,
              locator: evidence.locator,
              excerpt: evidence.excerpt,
              referenceDate: evidence.referenceDate,
              obtainedAt: evidence.obtainedAt,
              accessLevel: evidence.accessLevel,
              evidenceHash: hash({ analysisId: analysis.id, priorEvidenceId: evidence.id }),
            },
          });
        }
        if (dimension.perspective === "STUDIES") {
          await transaction.analysisEvidence.create({
            data: {
              id: randomUUID(),
              analysisId: analysis.id,
              dimensionResultId: dimensionRecord.id,
              sourceType: "GOOGLE_ROUTES_API",
              sourceId: response.requestId,
              sourceVersion: "v2",
              sourceHash: route.responseHash,
              locator: "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
              excerpt: `Matriz de rotas para ${destination.label} com ${bases.length} base(s) de origem.`,
              referenceDate: new Date(response.retrievedAt),
              accessLevel: "INTERNAL",
              evidenceHash: hash({
                analysisId: analysis.id,
                responseHash: route.responseHash,
                dimension: dimension.dimension,
              }),
            },
          });
        }
        for (const pendingItem of dimension.pendingItems) {
          await transaction.analysisPendingItem.create({
            data: {
              id: randomUUID(),
              analysisId: analysis.id,
              dimensionResultId: dimensionRecord.id,
              description: pendingItem.description,
              reason: pendingItem.reason,
              requiredInformation: pendingItem.requiredInformation,
            },
          });
        }
      }

      const climate = previous.climateStudy;
      await transaction.climateStudy.create({
        data: {
          id: randomUUID(),
          analysisId: analysis.id,
          provider: climate.provider,
          providerRequestId: climate.providerRequestId,
          locationLabel: climate.locationLabel,
          latitude: climate.latitude,
          longitude: climate.longitude,
          workStart: climate.workStart,
          workEnd: climate.workEnd,
          historyStart: climate.historyStart,
          historyEnd: climate.historyEnd,
          station: climate.station === null ? undefined : json(climate.station),
          monthlySeries: json(climate.monthlySeries),
          sourceMetadata: json(climate.sourceMetadata),
          dataCoverage: climate.dataCoverage,
          responseHash: climate.responseHash,
          retrievedAt: climate.retrievedAt,
          methodVersion: climate.methodVersion,
          resultHash: climate.resultHash,
        },
      });
      const routeStudy = await transaction.routeStudy.create({
        data: {
          id: randomUUID(),
          analysisId: analysis.id,
          provider: response.provider,
          providerRequestId: response.requestId,
          destinationLabel: destination.label,
          destinationLat: destination.latitude,
          destinationLng: destination.longitude,
          travelMode: destination.travelMode,
          alternatives: json(route.alternatives),
          selectionStatus: route.selectionStatus,
          requestHash: route.requestHash,
          responseHash: route.responseHash,
          retrievedAt: new Date(response.retrievedAt),
          methodVersion: "1.0.0",
          resultHash: route.resultHash,
        },
      });
      await enqueueIntelligenceNotifications(
        transaction,
        planAnalysisNotifications({
          opportunityId,
          opportunityCode: previous.opportunity.code,
          analysisId: analysis.id,
          analysisVersion: analysis.version,
          recipientId: previous.opportunity.ownerId ?? actorId,
          previousRecommendation: previous.recommendation,
          recommendation: consolidated.recommendation,
          status: consolidated.status,
          pendingCount: allDimensions.reduce((total, dimension) => total + dimension.pendingItems.length, 0),
          hasCriticalImpediment: false,
        }),
        correlationId,
      );
      await transaction.auditEvent.create({
        data: {
          id: randomUUID(),
          actorType: "USER",
          actorId,
          action: "OPPORTUNITY_ROUTE_STUDY_RECORDED",
          entityType: "ROUTE_STUDY",
          entityId: routeStudy.id,
          correlationId,
          outcome: "SUCCESS",
          origin: "opportunity-intelligence",
          metadata: {
            opportunityId,
            provider: response.provider,
            alternatives: route.alternatives.length,
            responseHash: route.responseHash,
            selectionStatus: route.selectionStatus,
          },
        },
      });
      return transaction.opportunityAnalysis.findUniqueOrThrow({
        where: { id: analysis.id },
        include: {
          routeStudy: { include: { details: true } },
          climateStudy: true,
          dimensions: { orderBy: [{ perspective: "asc" }, { dimension: "asc" }] },
        },
      });
    });
  }

  findRouteStudy(analysisId: string) {
    return getDatabase().routeStudy.findUnique({
      where: { analysisId },
      include: {
        details: { orderBy: { retrievedAt: "desc" } },
        analysis: { select: { id: true, opportunityId: true, version: true, recommendation: true, status: true } },
      },
    });
  }

  async findRouteDetailContext(analysisId: string, baseId: string) {
    const [study, base] = await Promise.all([
      getDatabase().routeStudy.findUnique({ where: { analysisId } }),
      getDatabase().operationalBase.findFirst({ where: { id: baseId, active: true } }),
    ]);
    if (!study || !base) return null;
    const alternatives = study.alternatives as Array<{ baseId: string }>;
    if (!alternatives.some(item => item.baseId === baseId)) return null;
    return {
      routeStudyId: study.id,
      destination: {
        label: study.destinationLabel,
        latitude: Number(study.destinationLat),
        longitude: Number(study.destinationLng),
        travelMode: "DRIVE" as const,
      },
      base: {
        id: base.id,
        code: base.code,
        name: base.name,
        locality: base.locality,
        latitude: Number(base.latitude),
        longitude: Number(base.longitude),
        version: base.version,
      },
    };
  }

  async recordRouteDetail(
    routeStudyId: string,
    detail: RouteDetail,
    responseHash: string,
    actorId: string,
    correlationId: string,
  ) {
    return getDatabase().$transaction(async transaction => {
      const replay = await transaction.routeDetailStudy.findUnique({
        where: {
          routeStudyId_baseId_responseHash: {
            routeStudyId,
            baseId: detail.baseId,
            responseHash,
          },
        },
      });
      if (replay) return replay;
      const record = await transaction.routeDetailStudy.create({
        data: {
          id: randomUUID(),
          routeStudyId,
          baseId: detail.baseId,
          provider: detail.provider,
          distanceMeters: detail.distanceMeters,
          durationSeconds: detail.durationSeconds,
          encodedPolyline: detail.encodedPolyline,
          tolls: json(detail.tolls),
          responseHash,
          retrievedAt: new Date(detail.retrievedAt),
        },
      });
      await transaction.auditEvent.create({
        data: {
          id: randomUUID(),
          actorType: "USER",
          actorId,
          action: "ROUTE_MAP_DETAIL_RECORDED",
          entityType: "ROUTE_DETAIL_STUDY",
          entityId: record.id,
          correlationId,
          outcome: "SUCCESS",
          origin: "opportunity-intelligence",
          metadata: { routeStudyId, baseId: detail.baseId, responseHash },
        },
      });
      return record;
    });
  }

  private toDomainDimension(dimension: {
    perspective: "COMMERCIAL" | "TECHNICAL" | "STUDIES";
    dimension: string;
    status: "CALCULATED" | "NOT_CALCULABLE";
    score: { toString(): string } | null;
    weight: { toString(): string };
    confidence: { toString(): string };
    summary: string;
    facts: unknown;
    calculations: unknown;
    inferences: unknown;
    risks: unknown;
    method: string;
    methodVersion: string;
    resultHash: string;
    pendingItems: Array<{ description: string; reason: string; requiredInformation: string }>;
  }): CommercialDimensionResult {
    return {
      perspective: dimension.perspective,
      dimension: dimension.dimension,
      status: dimension.status,
      ...(dimension.score !== null && { score: Number(dimension.score) }),
      weight: Number(dimension.weight),
      confidence: Number(dimension.confidence),
      summary: dimension.summary,
      facts: dimension.facts as Record<string, unknown>,
      calculations: dimension.calculations as Record<string, unknown>,
      inferences: dimension.inferences as string[],
      risks: dimension.risks as string[],
      method: dimension.method as CommercialDimensionResult["method"],
      methodVersion: dimension.methodVersion as "1.0.0",
      resultHash: dimension.resultHash,
      pendingItems: dimension.pendingItems,
    };
  }
}
