import { createHash, randomUUID } from "node:crypto";
import { getDatabase } from "@/core/database/prisma";
import { canonicalStringify } from "@/modules/compliance-matrices/domain/canonical-json";
import { OpportunityStatus, Prisma } from "@/generated/prisma/client";
import type { IndicatorRepository } from "../application/indicator-service";
import type { IndicatorApprovalDraft, IndicatorCalculationDraft, IndicatorDefinitionDraft, IndicatorPublicationDraft, IndicatorReconciliationDraft } from "../domain/indicator";

export class IndicatorNotFoundError extends Error {}
export class IndicatorRuleError extends Error {}

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
const afterDay = (value: string) => {
  const result = day(value);
  result.setUTCDate(result.getUTCDate() + 1);
  return result;
};
const decimal = (value: string | number | Prisma.Decimal) => new Prisma.Decimal(value);
const hash = (value: unknown) => createHash("sha256").update(canonicalStringify(value)).digest("hex");
const percent = (numerator: Prisma.Decimal, denominator: Prisma.Decimal) => {
  if (denominator.isZero()) throw new IndicatorRuleError("O denominador aprovado não possui registros no período informado.");
  return numerator.div(denominator).mul(100).toDecimalPlaces(8);
};

type SourceMapping = { logicalTable: string; field: string; validStatuses: string[] };

export class PrismaIndicatorRepository implements IndicatorRepository {
  async addDefinition(draft: IndicatorDefinitionDraft, actor: string, correlation: string) {
    return getDatabase().$transaction(async (tx) => {
      let previous = null;
      if (draft.previousDefinitionId) {
        previous = await tx.indicatorDefinition.findUnique({ where: { id: draft.previousDefinitionId } });
        if (!previous) throw new IndicatorNotFoundError("Definição anterior não encontrada.");
        if (previous.code !== draft.code) throw new IndicatorRuleError("O código do indicador não pode mudar entre versões.");
        const latest = await tx.indicatorDefinition.findFirst({ where: { indicatorKey: previous.indicatorKey }, orderBy: { version: "desc" } });
        if (latest?.id !== previous.id) throw new IndicatorRuleError("A revisão deve partir da definição mais recente.");
      }
      const definition = await tx.indicatorDefinition.create({
        data: {
          id: randomUUID(), indicatorKey: previous?.indicatorKey ?? randomUUID(), version: (previous?.version ?? 0) + 1,
          previousVersionId: previous?.id, code: draft.code, name: draft.name, purpose: draft.purpose,
          calculationMethod: draft.calculationMethod, ownerId: draft.ownerId,
          numeratorDefinition: draft.numeratorDefinition, denominatorDefinition: draft.denominatorDefinition,
          treatmentDefinition: draft.treatmentDefinition, granularity: draft.granularity,
          sourceMappings: draft.sourceMappings, dimensions: draft.dimensions,
          refreshPeriodicity: draft.refreshPeriodicity, refreshTime: draft.refreshTime,
          accessRule: draft.accessRule, rowSecurityRule: draft.rowSecurityRule,
          qualityTest: draft.qualityTest, qualityTolerance: draft.qualityTolerance, qualityOwnerId: draft.qualityOwnerId,
          effectiveFrom: day(draft.effectiveFrom), changeReason: draft.changeReason, createdBy: actor, correlationId: correlation,
        },
      });
      await tx.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId: actor, action: "INDICATOR_DEFINITION_RECORDED", entityType: "INDICATOR_DEFINITION", entityId: definition.id, correlationId: correlation, outcome: "SUCCESS", origin: "indicator-service", metadata: { indicatorKey: definition.indicatorKey, code: definition.code, version: definition.version, calculationMethod: definition.calculationMethod, effectiveFrom: draft.effectiveFrom } } });
      return definition;
    });
  }

  async approveDefinition(id: string, draft: IndicatorApprovalDraft, actor: string, correlation: string) {
    return getDatabase().$transaction(async (tx) => {
      if (!await tx.indicatorDefinition.findUnique({ where: { id } })) throw new IndicatorNotFoundError("Definição de indicador não encontrada.");
      const approval = await tx.indicatorApproval.create({ data: { id: randomUUID(), definitionId: id, note: draft.note, approvedAt: new Date(), approvedBy: actor, correlationId: correlation } });
      await tx.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId: actor, action: "INDICATOR_DEFINITION_APPROVED", entityType: "INDICATOR_DEFINITION", entityId: id, correlationId: correlation, outcome: "SUCCESS", origin: "indicator-service", metadata: { approvalId: approval.id, approvedAt: approval.approvedAt.toISOString() } } });
      return approval;
    });
  }

  async calculateDefinition(id: string, draft: IndicatorCalculationDraft, actor: string, correlation: string) {
    return getDatabase().$transaction(async (tx) => {
      const definition = await tx.indicatorDefinition.findUnique({ where: { id }, include: { approval: true } });
      if (!definition) throw new IndicatorNotFoundError("Definição de indicador não encontrada.");
      if (!definition.approval || !definition.calculationMethod) throw new IndicatorRuleError("O cálculo exige uma definição executável e aprovada.");
      const newerApproved = await tx.indicatorDefinition.findFirst({ where: { indicatorKey: definition.indicatorKey, version: { gt: definition.version }, effectiveFrom: { lte: day(draft.periodEnd) }, approval: { isNot: null } } });
      if (newerApproved) throw new IndicatorRuleError("Há uma revisão aprovada mais recente e vigente para o período.");

      const from = day(draft.periodStart), until = afterDay(draft.periodEnd);
      let numerator = decimal(0), denominator: Prisma.Decimal | null = null, value = decimal(0), unit = "COUNT";
      let sourcePayload: unknown;

      if (definition.calculationMethod === "PIPELINE_COUNT" || definition.calculationMethod === "PIPELINE_VALUE") {
        const mapping = (definition.sourceMappings as SourceMapping[]).find(item => item.logicalTable === "opportunities" && item.field === "status");
        if (!mapping) throw new IndicatorRuleError("O método de pipeline exige a fonte opportunities.status na definição aprovada.");
        const valid = new Set(Object.values(OpportunityStatus));
        if (mapping.validStatuses.some(status => !valid.has(status as OpportunityStatus))) throw new IndicatorRuleError("A definição aprovada contém status de oportunidade inválido.");
        if (definition.calculationMethod === "PIPELINE_VALUE" && !draft.currency) throw new IndicatorRuleError("O cálculo de valor do pipeline exige moeda.");
        const opportunities = await tx.opportunity.findMany({
          where: { createdAt: { lt: until }, status: { in: mapping.validStatuses as OpportunityStatus[] }, ...(draft.currency ? { currency: draft.currency } : {}) },
          select: { id: true, code: true, status: true, estimatedValue: true, currency: true, updatedAt: true }, orderBy: { id: "asc" },
        });
        if (definition.calculationMethod === "PIPELINE_COUNT") numerator = decimal(opportunities.length);
        else numerator = opportunities.reduce((sum, item) => sum.add(item.estimatedValue ?? 0), decimal(0));
        value = numerator; unit = definition.calculationMethod === "PIPELINE_COUNT" ? "COUNT" : "CURRENCY";
        sourcePayload = { method: definition.calculationMethod, asOf: draft.periodEnd, approvedStatuses: mapping.validStatuses, records: opportunities.map(item => ({ id: item.id, code: item.code, status: item.status, estimatedValue: item.estimatedValue?.toFixed(4) ?? null, currency: item.currency, updatedAt: item.updatedAt.toISOString() })) };
      } else if (definition.calculationMethod === "RESULT_CONVERSION_RATE") {
        const results = await tx.competitionResult.findMany({ where: { resultDate: { gte: from, lt: until }, validation: { isNot: null } }, include: { validation: true }, orderBy: [{ competitionId: "asc" }, { version: "desc" }] });
        const latest = results.filter((item, index) => results.findIndex(other => other.competitionId === item.competitionId) === index);
        const submissions = await tx.proposalSubmission.findMany({ where: { submittedAt: { gte: from, lt: until } }, select: { id: true, proposalId: true, submittedAt: true, payloadHash: true }, orderBy: { id: "asc" } });
        numerator = decimal(latest.filter(item => item.outcome === "WIN").length); denominator = decimal(submissions.length); value = percent(numerator, denominator); unit = "PERCENT";
        sourcePayload = { method: definition.calculationMethod, results: latest.map(item => ({ id: item.id, competitionId: item.competitionId, version: item.version, outcome: item.outcome, resultDate: item.resultDate.toISOString().slice(0, 10), validationId: item.validation!.id })), submissions: submissions.map(item => ({ id: item.id, proposalId: item.proposalId, submittedAt: item.submittedAt.toISOString(), payloadHash: item.payloadHash })) };
      } else {
        if (!draft.currency) throw new IndicatorRuleError("Este método exige moeda para impedir soma de valores incompatíveis.");
        const submissions = await tx.proposalSubmission.findMany({ where: { submittedAt: { gte: from, lt: until }, commercialScenario: { currency: draft.currency } }, include: { commercialScenario: true }, orderBy: { id: "asc" } });
        if (definition.calculationMethod === "FINANCIAL_CONVERSION_RATE") {
          const awards = await tx.competitionAward.findMany({ where: { currency: draft.currency, result: { resultDate: { gte: from, lt: until } } }, include: { result: { include: { validation: true } } }, orderBy: { id: "asc" } });
          numerator = awards.reduce((sum, item) => sum.add(item.contractValue), decimal(0));
          denominator = submissions.reduce((sum, item) => sum.add(item.commercialScenario.offeredPrice), decimal(0));
          value = percent(numerator, denominator); unit = "PERCENT";
          sourcePayload = { method: definition.calculationMethod, awards: awards.map(item => ({ id: item.id, resultId: item.resultId, contractValue: item.contractValue.toFixed(4), currency: item.currency, documentFileHash: item.documentFileHash, validationId: item.result.validation?.id })), submissions: submissions.map(item => ({ id: item.id, scenarioId: item.commercialScenarioId, offeredPrice: item.commercialScenario.offeredPrice.toFixed(4), currency: item.commercialScenario.currency, payloadHash: item.payloadHash })) };
        } else {
          const field = definition.calculationMethod === "AVERAGE_DISCOUNT_PERCENT" ? "discountPercent" : "marginPercent";
          numerator = submissions.reduce((sum, item) => sum.add(item.commercialScenario[field]), decimal(0));
          denominator = decimal(submissions.length); value = percent(numerator, denominator).div(100).toDecimalPlaces(8); unit = "PERCENT";
          sourcePayload = { method: definition.calculationMethod, field, submissions: submissions.map(item => ({ id: item.id, scenarioId: item.commercialScenarioId, value: item.commercialScenario[field].toFixed(6), currency: item.commercialScenario.currency, payloadHash: item.payloadHash })) };
        }
      }

      const payloadHash = hash(sourcePayload);
      const snapshot = await tx.indicatorSnapshot.create({ data: { id: randomUUID(), definitionId: definition.id, calculationMethod: definition.calculationMethod, periodStart: from, periodEnd: day(draft.periodEnd), currency: draft.currency, numerator, denominator, value, unit, sourceRecordCount: Array.isArray((sourcePayload as { records?: unknown[] }).records) ? (sourcePayload as { records: unknown[] }).records.length : ((sourcePayload as { results?: unknown[] }).results?.length ?? 0) + ((sourcePayload as { submissions?: unknown[] }).submissions?.length ?? 0) + ((sourcePayload as { awards?: unknown[] }).awards?.length ?? 0), sourcePayload: sourcePayload as Prisma.InputJsonValue, payloadHash, calculatedAt: new Date(), calculatedBy: actor, correlationId: correlation } });
      await tx.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId: actor, action: "INDICATOR_SNAPSHOT_CALCULATED", entityType: "INDICATOR_SNAPSHOT", entityId: snapshot.id, correlationId: correlation, outcome: "SUCCESS", origin: "indicator-service", metadata: { definitionId: definition.id, method: definition.calculationMethod, periodStart: draft.periodStart, periodEnd: draft.periodEnd, currency: draft.currency ?? null, payloadHash, value: value.toFixed(8) } } });
      return snapshot;
    });
  }

  async reconcileSnapshot(id: string, draft: IndicatorReconciliationDraft, actor: string, correlation: string) {
    const db=getDatabase(),baseline=await db.indicatorSnapshot.findUnique({where:{id}});
    if(!baseline)throw new IndicatorNotFoundError("Snapshot de referência não encontrado.");
    const observed=await this.calculateDefinition(baseline.definitionId,{periodStart:baseline.periodStart.toISOString().slice(0,10),periodEnd:baseline.periodEnd.toISOString().slice(0,10),currency:baseline.currency??undefined},actor,correlation);
    return db.$transaction(async tx=>{
      const numeratorDifference=observed.numerator.sub(baseline.numerator),denominatorDifference=observed.denominator===null&&baseline.denominator===null?null:(observed.denominator??decimal(0)).sub(baseline.denominator??decimal(0)),valueDifference=observed.value.sub(baseline.value),sourceCountDifference=observed.sourceRecordCount-baseline.sourceRecordCount;
      const denominatorsMatch=(observed.denominator===null&&baseline.denominator===null)||(observed.denominator!==null&&baseline.denominator!==null&&observed.denominator.equals(baseline.denominator));
      const status=observed.numerator.equals(baseline.numerator)&&denominatorsMatch&&observed.value.equals(baseline.value)&&sourceCountDifference===0&&observed.payloadHash===baseline.payloadHash?"MATCH":"DIVERGENT";
      const reconciliation=await tx.indicatorReconciliation.create({data:{id:randomUUID(),baselineSnapshotId:baseline.id,observedSnapshotId:observed.id,status,numeratorDifference,denominatorDifference,valueDifference,sourceCountDifference,checkedAt:new Date(),checkedBy:actor,note:draft.note,correlationId:correlation}});
      await tx.auditEvent.create({data:{id:randomUUID(),actorType:"USER",actorId:actor,action:"INDICATOR_SNAPSHOT_RECONCILED",entityType:"INDICATOR_RECONCILIATION",entityId:reconciliation.id,correlationId:correlation,outcome:status==="MATCH"?"SUCCESS":"FAILURE",origin:"indicator-service",metadata:{baselineSnapshotId:baseline.id,observedSnapshotId:observed.id,status,numeratorDifference:numeratorDifference.toFixed(8),denominatorDifference:denominatorDifference?.toFixed(8)??null,valueDifference:valueDifference.toFixed(8),sourceCountDifference,baselinePayloadHash:baseline.payloadHash,observedPayloadHash:observed.payloadHash}}});
      return reconciliation;
    });
  }

  async publishReconciliation(id:string,draft:IndicatorPublicationDraft,actor:string,correlation:string){return getDatabase().$transaction(async tx=>{const reconciliation=await tx.indicatorReconciliation.findUnique({where:{id},include:{publication:true,baselineSnapshot:true,observedSnapshot:{include:{definition:{include:{approval:true}}}}}});if(!reconciliation)throw new IndicatorNotFoundError("Conciliação não encontrada.");if(reconciliation.status!=="MATCH")throw new IndicatorRuleError("Somente conciliação exata pode ser publicada.");if(reconciliation.publication)throw new IndicatorRuleError("A conciliação já foi publicada.");const latestReconciliation=await tx.indicatorReconciliation.findFirst({where:{baselineSnapshotId:reconciliation.baselineSnapshotId},orderBy:{checkedAt:"desc"}});if(latestReconciliation?.id!==reconciliation.id)throw new IndicatorRuleError("Publique somente a conciliação mais recente do snapshot.");const definition=reconciliation.observedSnapshot.definition;if(!definition.approval)throw new IndicatorRuleError("A publicação exige definição aprovada.");const newer=await tx.indicatorDefinition.findFirst({where:{indicatorKey:definition.indicatorKey,version:{gt:definition.version},approval:{isNot:null}}});if(newer)throw new IndicatorRuleError("Há definição aprovada mais recente.");const lineage={definition:{id:definition.id,indicatorKey:definition.indicatorKey,version:definition.version,method:definition.calculationMethod},snapshot:{id:reconciliation.observedSnapshot.id,periodStart:reconciliation.observedSnapshot.periodStart.toISOString().slice(0,10),periodEnd:reconciliation.observedSnapshot.periodEnd.toISOString().slice(0,10),currency:reconciliation.observedSnapshot.currency,payloadHash:reconciliation.observedSnapshot.payloadHash,calculatedAt:reconciliation.observedSnapshot.calculatedAt.toISOString()},reconciliation:{id:reconciliation.id,baselineSnapshotId:reconciliation.baselineSnapshotId,status:reconciliation.status,checkedAt:reconciliation.checkedAt.toISOString()}};const publication=await tx.indicatorPublication.create({data:{id:randomUUID(),reconciliationId:reconciliation.id,snapshotId:reconciliation.observedSnapshot.id,qualityState:"MATCH",dataUpdatedAt:reconciliation.observedSnapshot.calculatedAt,lineageHash:hash(lineage),note:draft.note,publishedAt:new Date(),publishedBy:actor,correlationId:correlation}});await tx.auditEvent.create({data:{id:randomUUID(),actorType:"USER",actorId:actor,action:"INDICATOR_PUBLISHED",entityType:"INDICATOR_PUBLICATION",entityId:publication.id,correlationId:correlation,outcome:"SUCCESS",origin:"indicator-service",metadata:{definitionId:definition.id,snapshotId:publication.snapshotId,reconciliationId:reconciliation.id,qualityState:publication.qualityState,dataUpdatedAt:publication.dataUpdatedAt.toISOString(),lineageHash:publication.lineageHash}}});return publication})}
}
