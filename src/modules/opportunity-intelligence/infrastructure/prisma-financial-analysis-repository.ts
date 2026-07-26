import { createHash, randomUUID } from "node:crypto";

import { getDatabase } from "@/core/database/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { FinancialAnalysisRepository } from "../application/financial-analysis-service";
import { planAnalysisNotifications } from "../domain/intelligence-notification";
import { OpportunityAnalysisNotFoundError, OpportunityAnalysisRuleError } from "./prisma-opportunity-analysis-repository";
import { enqueueIntelligenceNotifications } from "./prisma-notification-outbox";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as object;

const responseInclude = {
  policy: { select: { id: true, code: true, version: true } },
  dimensions: { orderBy: [{ perspective: "asc" as const }, { dimension: "asc" as const }] },
  pendingItems: { where: { status: "OPEN" as const }, orderBy: { createdAt: "asc" as const } },
  impediments: { orderBy: { detectedAt: "asc" as const } },
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
};

export class PrismaFinancialAnalysisRepository implements FinancialAnalysisRepository {
  async run(opportunityId: string, actorId: string, correlationId: string) {
    return getDatabase().$transaction(async transaction => {
      const opportunity = await transaction.opportunity.findUnique({
        where: { id: opportunityId },
        select: {
          id: true,
          code: true,
          ownerId: true,
          customerId: true,
          contractingAuthorityId: true,
        },
      });
      if (!opportunity) throw new OpportunityAnalysisNotFoundError("Oportunidade não encontrada.");

      const base = await transaction.opportunityAnalysis.findFirst({
        where: { opportunityId, financialStudy: { is: null } },
        orderBy: { version: "desc" },
        include: {
          dimensions: {
            orderBy: [{ perspective: "asc" }, { dimension: "asc" }],
            include: {
              evidences: { orderBy: { obtainedAt: "asc" } },
              pendingItems: { where: { status: "OPEN" }, orderBy: { createdAt: "asc" } },
            },
          },
          climateStudy: true,
          routeStudy: { include: { details: true } },
        },
      });
      if (!base) {
        throw new OpportunityAnalysisRuleError(
          "Execute as análises comercial, técnica e os estudos aplicáveis antes da análise financeira.",
        );
      }

      const financial = await transaction.financialCapacityAssessment.findFirst({
        where: { opportunityId },
        orderBy: [{ version: "desc" }, { confirmedAt: "desc" }],
      });
      const payment = opportunity.customerId
        ? await transaction.customerPaymentAssessment.findFirst({
            where: { customerId: opportunity.customerId },
            orderBy: [{ version: "desc" }, { confirmedAt: "desc" }],
          })
        : opportunity.contractingAuthorityId
          ? await transaction.customerPaymentAssessment.findFirst({
              where: { authorityId: opportunity.contractingAuthorityId },
              orderBy: [{ version: "desc" }, { confirmedAt: "desc" }],
            })
          : null;

      const highIndebtednessRisk = financial?.conclusion === "HIGH_RISK";
      const nonPayingCustomer = payment?.classification === "NON_PAYER";
      const hasMissingInformation = !financial || !payment;
      const hasCriticalImpediment = highIndebtednessRisk || nonPayingCustomer;
      const inputHash = hash({
        baseInputHash: base.inputHash,
        financialAssessmentHash: financial?.assessmentHash ?? null,
        paymentAssessmentHash: payment?.assessmentHash ?? null,
      });
      const replay = await transaction.opportunityAnalysis.findUnique({
        where: {
          opportunityId_policyId_inputHash: {
            opportunityId,
            policyId: base.policyId,
            inputHash,
          },
        },
        include: responseInclude,
      });
      if (replay) return replay;

      const latest = await transaction.opportunityAnalysis.findFirst({
        where: { opportunityId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const status = hasCriticalImpediment
        ? "WAITING_OWNER"
        : hasMissingInformation ? "WAITING_INFORMATION" : base.status;
      const recommendation = hasCriticalImpediment
        ? "WAITING_OWNER_DECISION"
        : hasMissingInformation ? "WAITING_INFORMATION" : base.recommendation;
      const summary = this.summary(financial?.conclusion, payment?.classification);
      const analysis = await transaction.opportunityAnalysis.create({
        data: {
          id: randomUUID(),
          opportunityId,
          policyId: base.policyId,
          version: (latest?.version ?? 0) + 1,
          type: "ENRICHED",
          status,
          inputHash,
          score: base.score,
          coverage: base.coverage,
          confidence: base.confidence,
          recommendation,
          executiveSummary: `${base.executiveSummary ?? "Análise operacional preservada"} ${summary}`,
          requestedBy: actorId,
          startedAt: new Date(),
          completedAt: new Date(),
          correlationId,
        },
      });

      for (const dimension of base.dimensions) {
        const copied = await transaction.analysisDimensionResult.create({
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
        for (const evidence of dimension.evidences) {
          await transaction.analysisEvidence.create({
            data: {
              id: randomUUID(),
              analysisId: analysis.id,
              dimensionResultId: copied.id,
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
        for (const pending of dimension.pendingItems) {
          await transaction.analysisPendingItem.create({
            data: {
              id: randomUUID(),
              analysisId: analysis.id,
              dimensionResultId: copied.id,
              description: pending.description,
              reason: pending.reason,
              requiredInformation: pending.requiredInformation,
              responsibleId: pending.responsibleId,
              dueAt: pending.dueAt,
            },
          });
        }
      }

      if (!financial) {
        await transaction.analysisPendingItem.create({
          data: {
            id: randomUUID(),
            analysisId: analysis.id,
            description: "Avaliação de capacidade financeira não localizada.",
            reason: "Não existe registro formal e confirmado para esta oportunidade.",
            requiredInformation: "A área financeira deve registrar os índices exigidos e sua conclusão formal.",
            responsibleId: opportunity.ownerId,
          },
        });
      }
      if (!payment) {
        await transaction.analysisPendingItem.create({
          data: {
            id: randomUUID(),
            analysisId: analysis.id,
            description: "Classificação de pagamento do cliente não localizada.",
            reason: "Não existe histórico formal autorizado para o cliente ou órgão contratante.",
            requiredInformation: "A área financeira deve registrar a classificação formal com evidências.",
            responsibleId: opportunity.ownerId,
          },
        });
      }

      if (highIndebtednessRisk) {
        await transaction.criticalImpediment.create({
          data: {
            id: randomUUID(),
            analysisId: analysis.id,
            type: "HIGH_INDEBTEDNESS_RISK",
            ruleCode: "FINANCIAL-HIGH-RISK-001",
            severity: "CRITICAL",
            summary: "A avaliação financeira formal identificou alto risco de endividamento.",
            evidenceSnapshot: json({
              assessmentId: financial?.id,
              assessmentHash: financial?.assessmentHash,
              conclusion: financial?.conclusion,
            }),
          },
        });
      }
      if (nonPayingCustomer) {
        await transaction.criticalImpediment.create({
          data: {
            id: randomUUID(),
            analysisId: analysis.id,
            type: "NON_PAYING_CUSTOMER",
            ruleCode: "CLIENT-NON-PAYER-001",
            severity: "CRITICAL",
            summary: "A classificação financeira formal identificou cliente não pagador.",
            evidenceSnapshot: json({
              assessmentId: payment?.id,
              assessmentHash: payment?.assessmentHash,
              classification: payment?.classification,
            }),
          },
        });
      }

      await transaction.opportunityFinancialStudy.create({
        data: {
          id: randomUUID(),
          analysisId: analysis.id,
          financialAssessmentId: financial?.id,
          paymentAssessmentId: payment?.id,
          highIndebtednessRisk,
          nonPayingCustomer,
          summary,
          evidenceSnapshot: json({
            financialAssessment: financial && {
              id: financial.id,
              version: financial.version,
              hash: financial.assessmentHash,
              conclusion: financial.conclusion,
            },
            paymentAssessment: payment && {
              id: payment.id,
              version: payment.version,
              hash: payment.assessmentHash,
              classification: payment.classification,
            },
          }),
          resultHash: hash({
            financialAssessmentHash: financial?.assessmentHash ?? null,
            paymentAssessmentHash: payment?.assessmentHash ?? null,
            highIndebtednessRisk,
            nonPayingCustomer,
          }),
        },
      });
      await this.copyClimate(transaction, base, analysis.id);
      await this.copyRoute(transaction, base, analysis.id);
      await enqueueIntelligenceNotifications(
        transaction,
        planAnalysisNotifications({
          opportunityId,
          opportunityCode: opportunity.code,
          analysisId: analysis.id,
          analysisVersion: analysis.version,
          recipientId: opportunity.ownerId ?? actorId,
          previousRecommendation: base.recommendation,
          recommendation,
          status,
          pendingCount: hasMissingInformation ? 1 : 0,
          hasCriticalImpediment,
        }),
        correlationId,
      );

      await transaction.auditEvent.create({
        data: {
          id: randomUUID(),
          actorType: "USER",
          actorId,
          action: "OPPORTUNITY_FINANCIAL_RISK_ANALYZED",
          entityType: "OPPORTUNITY_ANALYSIS",
          entityId: analysis.id,
          correlationId,
          outcome: "SUCCESS",
          origin: "opportunity-intelligence",
          metadata: {
            opportunityId,
            analysisVersion: analysis.version,
            financialAssessmentVersion: financial?.version ?? null,
            paymentAssessmentVersion: payment?.version ?? null,
            hasMissingInformation,
            hasCriticalImpediment,
          },
        },
      });
      return transaction.opportunityAnalysis.findUniqueOrThrow({
        where: { id: analysis.id },
        include: responseInclude,
      });
    });
  }

  private summary(
    financialConclusion: "ADEQUATE" | "HIGH_RISK" | "INSUFFICIENT_DATA" | undefined,
    paymentClassification: "GOOD_PAYER" | "ATTENTION" | "NON_PAYER" | "INSUFFICIENT_DATA" | undefined,
  ) {
    if (!financialConclusion || !paymentClassification) {
      return "Análise financeira parcial: faltam avaliações formais; ausência de dados não foi tratada como resultado negativo.";
    }
    if (financialConclusion === "HIGH_RISK" || paymentClassification === "NON_PAYER") {
      return "Impedimento crítico financeiro identificado; a oportunidade aguarda decisão exclusiva do proprietário.";
    }
    if (financialConclusion === "INSUFFICIENT_DATA" || paymentClassification === "INSUFFICIENT_DATA") {
      return "As avaliações formais existem, mas ainda declaram dados insuficientes para conclusão.";
    }
    return "Capacidade financeira e histórico de pagamento avaliados formalmente, sem impedimento crítico.";
  }

  private async copyClimate(
    transaction: Prisma.TransactionClient,
    base: {
      climateStudy: {
        provider: string;
        providerRequestId: string | null;
        locationLabel: string;
        latitude: unknown;
        longitude: unknown;
        workStart: Date;
        workEnd: Date;
        historyStart: Date;
        historyEnd: Date;
        station: unknown;
        monthlySeries: unknown;
        sourceMetadata: unknown;
        dataCoverage: unknown;
        responseHash: string;
        retrievedAt: Date;
        methodVersion: string;
        resultHash: string;
      } | null;
    },
    analysisId: string,
  ) {
    if (!base.climateStudy) return;
    const climate = base.climateStudy;
    await transaction.climateStudy.create({
      data: {
        id: randomUUID(),
        analysisId,
        provider: climate.provider,
        providerRequestId: climate.providerRequestId,
        locationLabel: climate.locationLabel,
        latitude: climate.latitude as never,
        longitude: climate.longitude as never,
        workStart: climate.workStart,
        workEnd: climate.workEnd,
        historyStart: climate.historyStart,
        historyEnd: climate.historyEnd,
        station: climate.station ? json(climate.station) : undefined,
        monthlySeries: json(climate.monthlySeries),
        sourceMetadata: json(climate.sourceMetadata),
        dataCoverage: climate.dataCoverage as never,
        responseHash: climate.responseHash,
        retrievedAt: climate.retrievedAt,
        methodVersion: climate.methodVersion,
        resultHash: climate.resultHash,
      },
    });
  }

  private async copyRoute(
    transaction: Prisma.TransactionClient,
    base: {
      routeStudy: {
        provider: string;
        providerRequestId: string | null;
        destinationLabel: string;
        destinationLat: unknown;
        destinationLng: unknown;
        travelMode: string;
        alternatives: unknown;
        selectedBaseId: string | null;
        selectionStatus: string;
        requestHash: string;
        responseHash: string;
        retrievedAt: Date;
        methodVersion: string;
        resultHash: string;
        details: Array<{
          baseId: string;
          provider: string;
          distanceMeters: number;
          durationSeconds: unknown;
          encodedPolyline: string;
          tolls: unknown;
          responseHash: string;
          retrievedAt: Date;
        }>;
      } | null;
    },
    analysisId: string,
  ) {
    if (!base.routeStudy) return;
    const route = base.routeStudy;
    await transaction.routeStudy.create({
      data: {
        id: randomUUID(),
        analysisId,
        provider: route.provider,
        providerRequestId: route.providerRequestId,
        destinationLabel: route.destinationLabel,
        destinationLat: route.destinationLat as never,
        destinationLng: route.destinationLng as never,
        travelMode: route.travelMode,
        alternatives: json(route.alternatives),
        selectedBaseId: route.selectedBaseId,
        selectionStatus: route.selectionStatus,
        requestHash: route.requestHash,
        responseHash: route.responseHash,
        retrievedAt: route.retrievedAt,
        methodVersion: route.methodVersion,
        resultHash: route.resultHash,
        details: {
          create: route.details.map(detail => ({
            id: randomUUID(),
            baseId: detail.baseId,
            provider: detail.provider,
            distanceMeters: detail.distanceMeters,
            durationSeconds: detail.durationSeconds as never,
            encodedPolyline: detail.encodedPolyline,
            tolls: json(detail.tolls),
            responseHash: detail.responseHash,
            retrievedAt: detail.retrievedAt,
          })),
        },
      },
    });
  }
}
