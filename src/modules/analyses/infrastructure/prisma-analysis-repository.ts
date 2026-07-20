import { randomUUID } from "node:crypto";
import { getDatabase } from "@/core/database/prisma";
import type { RequirementAnalysis } from "@/generated/prisma/client";
import type { AnalysisRecord, AnalysisRepository } from "@/modules/analyses/application/analysis-service";
import type { AnalysisDraft } from "@/modules/analyses/domain/analysis";

export class AnalysisConcurrencyError extends Error { constructor(id: string) { super(`A análise foi alterada por outra operação: ${id}`); this.name = "AnalysisConcurrencyError"; } }
export class PrismaAnalysisRepository implements AnalysisRepository {
  async create(draft: AnalysisDraft, actorId: string, correlationId: string) {
    return getDatabase().$transaction(async (tx) => {
      const created = await tx.requirementAnalysis.create({ data: { id: randomUUID(), ...draft, status: "PENDING", version: 1, createdBy: actorId, updatedBy: actorId } });
      await tx.analysisHistory.create({ data: { id: randomUUID(), analysisId: created.id, version: 1, action: "ASSIGNED", changes: { competence: draft.competence, priority: draft.priority, assigneeId: draft.assigneeId }, changedById: actorId, correlationId } });
      await tx.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId, action: "ANALYSIS_ASSIGNED", entityType: "REQUIREMENT_ANALYSIS", entityId: created.id, correlationId, outcome: "SUCCESS", origin: "analysis-service", metadata: { competence: draft.competence, assigneeId: draft.assigneeId } } });
      return this.toRecord(created);
    });
  }
  async findById(id: string) { const value = await getDatabase().requirementAnalysis.findUnique({ where: { id } }); return value ? this.toRecord(value) : null; }
  async decide(record: AnalysisRecord, decision: "VALIDATED" | "REJECTED", justification: string, actorId: string, correlationId: string) {
    return getDatabase().$transaction(async (tx) => {
      const changed = await tx.requirementAnalysis.updateMany({ where: { id: record.id, version: record.version, status: "PENDING" }, data: { status: decision, justification, decidedAt: new Date(), decidedById: actorId, version: record.version + 1, updatedBy: actorId } });
      if (changed.count !== 1) throw new AnalysisConcurrencyError(record.id);
      await tx.analysisHistory.create({ data: { id: randomUUID(), analysisId: record.id, version: record.version + 1, action: decision, changes: { status: { from: "PENDING", to: decision } }, reason: justification, changedById: actorId, correlationId } });
      await tx.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId, action: `ANALYSIS_${decision}`, entityType: "REQUIREMENT_ANALYSIS", entityId: record.id, correlationId, outcome: "SUCCESS", origin: "analysis-service", metadata: { competence: record.competence, justification } } });
      return this.toRecord(await tx.requirementAnalysis.findUniqueOrThrow({ where: { id: record.id } }));
    });
  }
  async reassign(record: AnalysisRecord, assigneeId: string, reason: string, actorId: string, correlationId: string) {
    return getDatabase().$transaction(async (tx) => {
      const changed = await tx.requirementAnalysis.updateMany({ where: { id: record.id, version: record.version, status: "PENDING" }, data: { assigneeId, version: record.version + 1, updatedBy: actorId } });
      if (changed.count !== 1) throw new AnalysisConcurrencyError(record.id);
      await tx.analysisHistory.create({ data: { id: randomUUID(), analysisId: record.id, version: record.version + 1, action: "REASSIGNED", changes: { assigneeId: { from: record.assigneeId, to: assigneeId } }, reason, changedById: actorId, correlationId } });
      await tx.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId, action: "ANALYSIS_REASSIGNED", entityType: "REQUIREMENT_ANALYSIS", entityId: record.id, correlationId, outcome: "SUCCESS", origin: "analysis-service", metadata: { from: record.assigneeId, to: assigneeId, reason } } });
      return this.toRecord(await tx.requirementAnalysis.findUniqueOrThrow({ where: { id: record.id } }));
    });
  }
  private toRecord(value: RequirementAnalysis): AnalysisRecord { return { id: value.id, requirementId: value.requirementId, competence: value.competence, priority: value.priority, assigneeId: value.assigneeId, status: value.status, version: value.version }; }
}
