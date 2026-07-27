import { createHash, randomUUID } from "node:crypto";

import { getDatabase } from "@/core/database/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  approvedPolicySnapshotSchema,
  calculateCommercialPreliminaryAnalysis,
  commercialOpportunitySnapshotSchema,
} from "../domain/commercial-preliminary-analysis";
import {
  intelligenceDimensionSchema,
  intelligenceThresholdsSchema,
  intelligenceWeightsSchema,
} from "../domain/intelligence-policy";
import { consolidateAnalysis } from "../domain/analysis-consolidation";
import { calculateTechnicalCapacity } from "../domain/technical-capacity-analysis";
import {
  calculateClimateStudy,
  type ClimateApiResponse,
  type ClimateStudyContext,
} from "../domain/climate-study";
import type { CommercialDimensionResult } from "../domain/commercial-preliminary-analysis";
import type { OpportunityAnalysisRepository } from "../application/opportunity-analysis-service";
import { planAnalysisNotifications } from "../domain/intelligence-notification";
import { enqueueIntelligenceNotifications } from "./prisma-notification-outbox";

export class OpportunityAnalysisNotFoundError extends Error {}
export class OpportunityAnalysisRuleError extends Error {}

const analysisInclude = {
  policy: {
    select: {
      id: true,
      code: true,
      name: true,
      version: true,
      coverageMinimum: true,
      effectiveFrom: true,
    },
  },
  dimensions: {
    orderBy: [{ perspective: "asc" as const }, { dimension: "asc" as const }],
    include: {
      pendingItems: { orderBy: { createdAt: "asc" as const } },
      evidences: { orderBy: { obtainedAt: "asc" as const } },
    },
  },
  pendingItems: { orderBy: { createdAt: "asc" as const } },
  impediments: { orderBy: { detectedAt: "asc" as const } },
  decisions: { orderBy: { decidedAt: "desc" as const } },
  climateStudy: true,
  routeStudy: true,
  financialStudy: {
    select: {
      id: true,
      highIndebtednessRisk: true,
      nonPayingCustomer: true,
      summary: true,
      createdAt: true,
    },
  },
} satisfies Prisma.OpportunityAnalysisInclude;

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as object;

export class PrismaOpportunityAnalysisRepository implements OpportunityAnalysisRepository {
  async runCommercialPreliminary(opportunityId: string, actorId: string, correlationId: string) {
    return getDatabase().$transaction(async transaction => {
      const opportunity = await transaction.opportunity.findUnique({ where: { id: opportunityId } });
      if (!opportunity) throw new OpportunityAnalysisNotFoundError("Oportunidade não encontrada.");

      const policyRecord = await transaction.intelligencePolicy.findFirst({
        where: {
          effectiveFrom: { lte: new Date() },
          approval: { isNot: null },
        },
        orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }],
      });
      if (!policyRecord) {
        throw new OpportunityAnalysisRuleError(
          "Nenhuma política de inteligência aprovada e vigente foi encontrada.",
        );
      }

      const opportunitySnapshot = commercialOpportunitySnapshotSchema.parse({
        id: opportunity.id,
        version: opportunity.version,
        code: opportunity.code,
        origin: opportunity.origin,
        subject: opportunity.subject ?? undefined,
        customerId: opportunity.customerId ?? undefined,
        contractingAuthorityId: opportunity.contractingAuthorityId ?? undefined,
        estimatedValue: opportunity.estimatedValue === null ? undefined : Number(opportunity.estimatedValue),
        currency: opportunity.currency ?? undefined,
        valueSource: opportunity.valueSource ?? undefined,
        publishedAt: opportunity.publishedAt ?? undefined,
        deliveryAt: opportunity.deliveryAt ?? undefined,
        datesSource: opportunity.datesSource ?? undefined,
        datesTimeZone: opportunity.datesTimeZone ?? undefined,
        ownerId: opportunity.ownerId ?? undefined,
      });
      const policySnapshot = approvedPolicySnapshotSchema.parse({
        id: policyRecord.id,
        version: policyRecord.version,
        dimensions: intelligenceDimensionSchema.array().parse(policyRecord.dimensions),
        weights: intelligenceWeightsSchema.parse(policyRecord.weights),
        thresholds: intelligenceThresholdsSchema.parse(policyRecord.thresholds),
        coverageMinimum: Number(policyRecord.coverageMinimum),
      });
      const result = calculateCommercialPreliminaryAnalysis(opportunitySnapshot, policySnapshot);

      const replay = await transaction.opportunityAnalysis.findUnique({
        where: {
          opportunityId_policyId_inputHash: {
            opportunityId,
            policyId: policyRecord.id,
            inputHash: result.inputHash,
          },
        },
        include: analysisInclude,
      });
      if (replay) return replay;

      const latest = await transaction.opportunityAnalysis.findFirst({
        where: { opportunityId },
        orderBy: { version: "desc" },
        select: { version: true, recommendation: true },
      });
      const analysis = await transaction.opportunityAnalysis.create({
        data: {
          id: randomUUID(),
          opportunityId,
          policyId: policyRecord.id,
          version: (latest?.version ?? 0) + 1,
          type: "PRELIMINARY",
          status: result.status,
          inputHash: result.inputHash,
          score: result.score,
          coverage: result.coverage,
          confidence: result.confidence,
          recommendation: result.recommendation,
          executiveSummary: result.executiveSummary,
          requestedBy: actorId,
          startedAt: new Date(),
          completedAt: new Date(),
          correlationId,
        },
      });

      for (const dimension of result.dimensions) {
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
        const evidenceHash = hash({
          analysisId: analysis.id,
          dimension: dimension.dimension,
          source: opportunitySnapshot,
        });
        await transaction.analysisEvidence.create({
          data: {
            id: randomUUID(),
            analysisId: analysis.id,
            dimensionResultId: dimensionRecord.id,
            sourceType: "OPPORTUNITY",
            sourceId: opportunity.id,
            sourceVersion: opportunity.version.toString(),
            sourceHash: result.inputHash,
            locator: `/opportunities/${opportunity.id}`,
            excerpt: `Oportunidade ${opportunity.code}, versão ${opportunity.version}.`,
            referenceDate: opportunity.updatedAt,
            accessLevel: "INTERNAL",
            evidenceHash,
          },
        });
        for (const pendingItem of dimension.pendingItems) {
          await transaction.analysisPendingItem.create({
            data: {
              id: randomUUID(),
              analysisId: analysis.id,
              dimensionResultId: dimensionRecord.id,
              description: pendingItem.description,
              reason: pendingItem.reason,
              requiredInformation: pendingItem.requiredInformation,
              responsibleId: opportunity.ownerId,
            },
          });
        }
      }

      await enqueueIntelligenceNotifications(
        transaction,
        planAnalysisNotifications({
          opportunityId,
          opportunityCode: opportunity.code,
          analysisId: analysis.id,
          analysisVersion: analysis.version,
          recipientId: opportunity.ownerId ?? actorId,
          previousRecommendation: latest?.recommendation,
          recommendation: result.recommendation,
          status: result.status,
          pendingCount: result.dimensions.reduce((total, dimension) => total + dimension.pendingItems.length, 0),
          hasCriticalImpediment: false,
        }),
        correlationId,
      );

      await transaction.auditEvent.create({
        data: {
          id: randomUUID(),
          actorType: "USER",
          actorId,
          action: "OPPORTUNITY_COMMERCIAL_ANALYSIS_COMPLETED",
          entityType: "OPPORTUNITY_ANALYSIS",
          entityId: analysis.id,
          correlationId,
          outcome: "SUCCESS",
          origin: "opportunity-intelligence",
          metadata: {
            opportunityId,
            policyId: policyRecord.id,
            analysisVersion: analysis.version,
            inputHash: result.inputHash,
            coverage: result.coverage,
            recommendation: result.recommendation,
          },
        },
      });

      return transaction.opportunityAnalysis.findUniqueOrThrow({
        where: { id: analysis.id },
        include: analysisInclude,
      });
    });
  }

  async runTechnicalCapacity(opportunityId: string, actorId: string, correlationId: string) {
    return getDatabase().$transaction(async transaction => {
      const opportunity = await transaction.opportunity.findUnique({ where: { id: opportunityId } });
      if (!opportunity) throw new OpportunityAnalysisNotFoundError("Oportunidade não encontrada.");
      const policyRecord = await transaction.intelligencePolicy.findFirst({
        where: { effectiveFrom: { lte: new Date() }, approval: { isNot: null } },
        orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }],
      });
      if (!policyRecord) {
        throw new OpportunityAnalysisRuleError(
          "Nenhuma política de inteligência aprovada e vigente foi encontrada.",
        );
      }

      const opportunitySnapshot = commercialOpportunitySnapshotSchema.parse({
        id: opportunity.id,
        version: opportunity.version,
        code: opportunity.code,
        origin: opportunity.origin,
        subject: opportunity.subject ?? undefined,
        customerId: opportunity.customerId ?? undefined,
        contractingAuthorityId: opportunity.contractingAuthorityId ?? undefined,
        estimatedValue: opportunity.estimatedValue === null ? undefined : Number(opportunity.estimatedValue),
        currency: opportunity.currency ?? undefined,
        valueSource: opportunity.valueSource ?? undefined,
        publishedAt: opportunity.publishedAt ?? undefined,
        deliveryAt: opportunity.deliveryAt ?? undefined,
        datesSource: opportunity.datesSource ?? undefined,
        datesTimeZone: opportunity.datesTimeZone ?? undefined,
        ownerId: opportunity.ownerId ?? undefined,
      });
      const dimensions = intelligenceDimensionSchema.array().parse(policyRecord.dimensions);
      const policySnapshot = approvedPolicySnapshotSchema.parse({
        id: policyRecord.id,
        version: policyRecord.version,
        dimensions,
        weights: intelligenceWeightsSchema.parse(policyRecord.weights),
        thresholds: intelligenceThresholdsSchema.parse(policyRecord.thresholds),
        coverageMinimum: Number(policyRecord.coverageMinimum),
      });
      const tenderVersion = await transaction.tenderVersion.findFirst({
        where: { tender: { opportunityId } },
        orderBy: [{ receivedAt: "desc" }, { version: "desc" }],
        include: {
          complianceMatrices: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              items: {
                orderBy: [{ criticality: "desc" }, { sourcePage: "asc" }],
                include: {
                  assessments: { orderBy: { version: "desc" }, take: 1 },
                },
              },
            },
          },
        },
      });
      const matrix = tenderVersion?.complianceMatrices[0];
      const technicalSnapshot = {
        tenderVersionId: tenderVersion?.id,
        tenderVersion: tenderVersion?.version,
        tenderFileHash: tenderVersion?.fileHash,
        matrixId: matrix?.id,
        matrixVersion: matrix?.version,
        matrixStatus: matrix?.status,
        items: matrix?.items.map(item => {
          const assessment = item.assessments[0];
          return {
            id: item.id,
            requirementId: item.requirementId,
            requirementVersion: item.requirementVersion,
            requirementText: item.requirementText,
            criticality: item.criticality,
            sourcePage: item.sourcePage,
            ...(assessment && {
              assessment: {
                id: assessment.id,
                version: assessment.version,
                decision: assessment.decision,
                justification: assessment.justification,
                evidenceCount: assessment.evidenceCount,
                validatedAt: assessment.validatedAt,
              },
            }),
          };
        }) ?? [],
      };
      const commercial = calculateCommercialPreliminaryAnalysis(opportunitySnapshot, policySnapshot);
      const technical = calculateTechnicalCapacity(
        technicalSnapshot,
        dimensions.filter(dimension => dimension.perspective === "TECHNICAL"),
        policySnapshot.weights.technical,
      );
      const allDimensions = [...commercial.dimensions, ...technical.dimensions];
      const consolidated = consolidateAnalysis(
        allDimensions,
        policySnapshot,
        {
          hasCriticalFailure: technical.hasCriticalFailure,
          hasUnresolvedCritical: technical.hasUnresolvedCritical,
        },
      );
      const inputHash = hash({
        commercialInputHash: commercial.inputHash,
        technicalInputHash: technical.inputHash,
        policyId: policyRecord.id,
      });
      const replay = await transaction.opportunityAnalysis.findUnique({
        where: {
          opportunityId_policyId_inputHash: {
            opportunityId,
            policyId: policyRecord.id,
            inputHash,
          },
        },
        include: analysisInclude,
      });
      if (replay) return replay;

      const latest = await transaction.opportunityAnalysis.findFirst({
        where: { opportunityId },
        orderBy: { version: "desc" },
        select: { version: true, recommendation: true },
      });
      const analysis = await transaction.opportunityAnalysis.create({
        data: {
          id: randomUUID(),
          opportunityId,
          policyId: policyRecord.id,
          version: (latest?.version ?? 0) + 1,
          type: "ENRICHED",
          status: consolidated.status,
          inputHash,
          score: consolidated.score,
          coverage: consolidated.coverage,
          confidence: consolidated.confidence,
          recommendation: consolidated.recommendation,
          executiveSummary: this.technicalSummary(technical, consolidated),
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
        const isTechnical = dimension.perspective === "TECHNICAL";
        const evidenceHash = hash({
          analysisId: analysis.id,
          dimension: dimension.dimension,
          sourceId: isTechnical ? matrix?.id ?? tenderVersion?.id ?? opportunity.id : opportunity.id,
          sourceHash: isTechnical ? technical.inputHash : commercial.inputHash,
        });
        await transaction.analysisEvidence.create({
          data: {
            id: randomUUID(),
            analysisId: analysis.id,
            dimensionResultId: dimensionRecord.id,
            sourceType: isTechnical ? (matrix ? "COMPLIANCE_MATRIX" : "TENDER_VERSION") : "OPPORTUNITY",
            sourceId: isTechnical ? matrix?.id ?? tenderVersion?.id : opportunity.id,
            sourceVersion: isTechnical ? matrix?.version.toString() ?? tenderVersion?.version.toString() : opportunity.version.toString(),
            sourceHash: isTechnical ? technical.inputHash : commercial.inputHash,
            locator: isTechnical
              ? matrix ? `/compliance-matrices?matrix=${matrix.id}` : "/compliance-matrices"
              : `/opportunities/${opportunity.id}`,
            excerpt: isTechnical
              ? matrix
                ? `Matriz ${matrix.analysisReference}, versão ${matrix.version}, com ${matrix.itemCount} requisito(s).`
                : "Matriz de atendimento ainda não localizada para a oportunidade."
              : `Oportunidade ${opportunity.code}, versão ${opportunity.version}.`,
            referenceDate: isTechnical ? matrix?.updatedAt ?? tenderVersion?.receivedAt : opportunity.updatedAt,
            accessLevel: "INTERNAL",
            evidenceHash,
          },
        });
        for (const pendingItem of dimension.pendingItems) {
          await transaction.analysisPendingItem.create({
            data: {
              id: randomUUID(),
              analysisId: analysis.id,
              dimensionResultId: dimensionRecord.id,
              description: pendingItem.description,
              reason: pendingItem.reason,
              requiredInformation: pendingItem.requiredInformation,
              responsibleId: opportunity.ownerId,
            },
          });
        }
      }

      await enqueueIntelligenceNotifications(
        transaction,
        planAnalysisNotifications({
          opportunityId,
          opportunityCode: opportunity.code,
          analysisId: analysis.id,
          analysisVersion: analysis.version,
          recipientId: opportunity.ownerId ?? actorId,
          previousRecommendation: latest?.recommendation,
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
          action: "OPPORTUNITY_TECHNICAL_CAPACITY_ANALYZED",
          entityType: "OPPORTUNITY_ANALYSIS",
          entityId: analysis.id,
          correlationId,
          outcome: "SUCCESS",
          origin: "opportunity-intelligence",
          metadata: {
            opportunityId,
            policyId: policyRecord.id,
            matrixId: matrix?.id ?? null,
            analysisVersion: analysis.version,
            coverage: consolidated.coverage,
            recommendation: consolidated.recommendation,
            hasCriticalFailure: technical.hasCriticalFailure,
            hasUnresolvedCritical: technical.hasUnresolvedCritical,
          },
        },
      });
      return transaction.opportunityAnalysis.findUniqueOrThrow({
        where: { id: analysis.id },
        include: analysisInclude,
      });
    });
  }

  async recordClimateStudy(
    opportunityId: string,
    context: ClimateStudyContext,
    response: ClimateApiResponse,
    actorId: string,
    correlationId: string,
  ) {
    return getDatabase().$transaction(async transaction => {
      const previous = await transaction.opportunityAnalysis.findFirst({
        where: { opportunityId },
        orderBy: { version: "desc" },
        include: {
          policy: true,
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
      if (!previous) {
        throw new OpportunityAnalysisRuleError(
          "Execute a análise da oportunidade antes do estudo climático.",
        );
      }
      const policyDimensions = intelligenceDimensionSchema.array().parse(previous.policy.dimensions);
      const policySnapshot = approvedPolicySnapshotSchema.parse({
        id: previous.policy.id,
        version: previous.policy.version,
        dimensions: policyDimensions,
        weights: intelligenceWeightsSchema.parse(previous.policy.weights),
        thresholds: intelligenceThresholdsSchema.parse(previous.policy.thresholds),
        coverageMinimum: Number(previous.policy.coverageMinimum),
      });
      const climate = calculateClimateStudy(
        context,
        response,
        policyDimensions.filter(dimension => dimension.perspective === "STUDIES"),
        policySnapshot.weights.studies,
      );
      const priorDimensions = previous.dimensions.map<CommercialDimensionResult>(dimension => ({
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
        methodVersion: "1.0.0",
        resultHash: dimension.resultHash,
        pendingItems: dimension.pendingItems.map(item => ({
          description: item.description,
          reason: item.reason,
          requiredInformation: item.requiredInformation,
        })),
      }));
      const climateDimensionCodes = new Set(climate.dimensions.map(dimension => dimension.dimension));
      const allDimensions = [
        ...priorDimensions.filter(dimension => !(dimension.perspective === "STUDIES" && climateDimensionCodes.has(dimension.dimension))),
        ...climate.dimensions,
      ];
      const technicalFacts = previous.dimensions.find(
        dimension => dimension.perspective === "TECHNICAL",
      )?.facts as { criticalFailures?: number; unresolvedCriticalRequirements?: number } | undefined;
      const consolidated = consolidateAnalysis(
        allDimensions,
        policySnapshot,
        {
          hasCriticalFailure: (technicalFacts?.criticalFailures ?? 0) > 0,
          hasUnresolvedCritical: (technicalFacts?.unresolvedCriticalRequirements ?? 0) > 0,
        },
      );
      const inputHash = hash({
        previousInputHash: previous.inputHash,
        climateResultHash: climate.resultHash,
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
        include: analysisInclude,
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
          executiveSummary: `${previous.executiveSummary ?? "Análise comercial e técnica preservada"} `
            + `Estudo climático obtido por API para ${context.locationLabel}: `
            + `${climate.expectedHistoricalPrecipitationMm.toFixed(1)} mm no período mensal equivalente. `
            + "O dado não foi convertido automaticamente em atraso ou perda de produtividade.",
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
        const sourceDimension = previous.dimensions.find(item =>
          item.perspective === dimension.perspective && item.dimension === dimension.dimension
        );
        if (sourceDimension) {
          for (const evidence of sourceDimension.evidences) {
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
                evidenceHash: hash({ analysisId: analysis.id, sourceEvidenceId: evidence.id }),
              },
            });
          }
        } else {
          await transaction.analysisEvidence.create({
            data: {
              id: randomUUID(),
              analysisId: analysis.id,
              dimensionResultId: dimensionRecord.id,
              sourceType: "CLIMATE_API",
              sourceId: response.requestId,
              sourceVersion: `${response.historyStart}:${response.historyEnd}`,
              sourceHash: climate.responseHash,
              locator: `climate-api://${response.provider}`,
              excerpt: `Série histórica mensal obtida para ${context.locationLabel}.`,
              referenceDate: new Date(response.retrievedAt),
              accessLevel: "INTERNAL",
              evidenceHash: hash({
                analysisId: analysis.id,
                provider: response.provider,
                responseHash: climate.responseHash,
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

      await transaction.climateStudy.create({
        data: {
          id: randomUUID(),
          analysisId: analysis.id,
          provider: response.provider,
          providerRequestId: response.requestId,
          locationLabel: context.locationLabel,
          latitude: context.latitude,
          longitude: context.longitude,
          workStart: new Date(`${context.workStart}T00:00:00.000Z`),
          workEnd: new Date(`${context.workEnd}T00:00:00.000Z`),
          historyStart: new Date(`${response.historyStart}T00:00:00.000Z`),
          historyEnd: new Date(`${response.historyEnd}T00:00:00.000Z`),
          station: response.station ? json(response.station) : undefined,
          monthlySeries: json(climate.monthlySeries),
          sourceMetadata: json(response.sourceMetadata),
          dataCoverage: climate.dataCoverage,
          responseHash: climate.responseHash,
          retrievedAt: new Date(response.retrievedAt),
          methodVersion: "1.0.0",
          resultHash: climate.resultHash,
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
          action: "OPPORTUNITY_CLIMATE_STUDY_RECORDED",
          entityType: "OPPORTUNITY_ANALYSIS",
          entityId: analysis.id,
          correlationId,
          outcome: "SUCCESS",
          origin: "opportunity-intelligence",
          metadata: {
            opportunityId,
            provider: response.provider,
            responseHash: climate.responseHash,
            dataCoverage: climate.dataCoverage,
            historyStart: response.historyStart,
            historyEnd: response.historyEnd,
          },
        },
      });
      return transaction.opportunityAnalysis.findUniqueOrThrow({
        where: { id: analysis.id },
        include: analysisInclude,
      });
    });
  }

  findClimateStudy(analysisId: string) {
    return getDatabase().climateStudy.findUnique({
      where: { analysisId },
      include: {
        analysis: {
          select: {
            id: true,
            opportunityId: true,
            version: true,
            recommendation: true,
            status: true,
          },
        },
      },
    });
  }

  findLatest(opportunityId: string) {
    return getDatabase().opportunityAnalysis.findFirst({
      where: { opportunityId },
      orderBy: { version: "desc" },
      include: analysisInclude,
    });
  }

  listVersions(opportunityId: string) {
    return getDatabase().opportunityAnalysis.findMany({
      where: { opportunityId },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        type: true,
        status: true,
        score: true,
        coverage: true,
        confidence: true,
        recommendation: true,
        requestedAt: true,
        completedAt: true,
        policy: { select: { id: true, code: true, version: true } },
      },
    });
  }

  private technicalSummary(
    technical: ReturnType<typeof calculateTechnicalCapacity>,
    consolidated: ReturnType<typeof consolidateAnalysis>,
  ) {
    if (technical.hasCriticalFailure) {
      return "Capacidade operacional não recomendada: existe requisito crítico formalmente não atendido.";
    }
    if (technical.hasUnresolvedCritical) {
      return "Análise parcial: existem requisitos críticos que ainda precisam de comprovação integral.";
    }
    return `Análise comercial e técnica consolidada com ${consolidated.coverage.toFixed(0)}% de cobertura. `
      + `${technical.assessedRequirements} de ${technical.totalRequirements} requisito(s) técnico(s) foram avaliados.`;
  }
}
