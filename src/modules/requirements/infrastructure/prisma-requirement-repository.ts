import { randomUUID } from "node:crypto";
import { getDatabase } from "@/core/database/prisma";
import type { TenderRequirement } from "@/generated/prisma/client";
import type { RequirementRecord, RequirementRepository, RequirementRevision } from "@/modules/requirements/application/requirement-service";
import type { RequirementDraft } from "@/modules/requirements/domain/requirement";

export class RequirementConcurrencyError extends Error { constructor(id: string) { super(`O requisito foi alterado por outra operação: ${id}`); this.name = "RequirementConcurrencyError"; } }
export class RequirementValidationBlockedError extends Error { constructor(message: string) { super(message); this.name = "RequirementValidationBlockedError"; } }

export class PrismaRequirementRepository implements RequirementRepository {
  async create(draft: RequirementDraft, actorId: string, correlationId: string) {
    return getDatabase().$transaction(async transaction => {
      const created = await transaction.tenderRequirement.create({ data: { id: randomUUID(), ...draft, status: "DRAFT", version: 1, createdBy: actorId, updatedBy: actorId } });
      await transaction.requirementHistory.create({ data: { id: randomUUID(), requirementId: created.id, version: 1, action: "CREATED", changes: { sourceExcerpt: draft.sourceExcerpt, sourcePage: draft.sourcePage }, changedById: actorId, correlationId } });
      await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId, action: "REQUIREMENT_CREATED", entityType: "TENDER_REQUIREMENT", entityId: created.id, correlationId, outcome: "SUCCESS", origin: "requirement-service", metadata: { tenderVersionId: draft.tenderVersionId, sourcePage: draft.sourcePage } } });
      return this.toRecord(created);
    });
  }

  async findById(id: string) {
    const value = await getDatabase().tenderRequirement.findUnique({ where: { id } });
    return value ? this.toRecord(value) : null;
  }

  async revise(revision: RequirementRevision) {
    return getDatabase().$transaction(async transaction => {
      const result = await transaction.tenderRequirement.updateMany({ where: { id: revision.before.id, version: revision.before.version }, data: { type: revision.after.type, text: revision.after.text, criticality: revision.after.criticality, responsibleId: revision.after.responsibleId, sourceExcerpt: revision.after.sourceExcerpt, sourcePage: revision.after.sourcePage, status: revision.after.status, version: revision.after.version, updatedBy: revision.actorId } });
      if (result.count !== 1) throw new RequirementConcurrencyError(revision.before.id);
      await transaction.requirementHistory.create({ data: { id: randomUUID(), requirementId: revision.before.id, version: revision.after.version, action: "UPDATED", changes: JSON.parse(JSON.stringify(revision.changes)), changedById: revision.actorId, correlationId: revision.correlationId } });
      await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId: revision.actorId, action: "REQUIREMENT_UPDATED", entityType: "TENDER_REQUIREMENT", entityId: revision.before.id, correlationId: revision.correlationId, outcome: "SUCCESS", origin: "requirement-service", metadata: { version: revision.after.version, revalidationRequired: revision.before.status === "VALIDATED" } } });
      return this.toRecord(await transaction.tenderRequirement.findUniqueOrThrow({ where: { id: revision.before.id } }));
    });
  }

  async validate(id: string, justification: string, actorId: string, correlationId: string) {
    return getDatabase().$transaction(async transaction => {
      const requirement = await transaction.tenderRequirement.findUniqueOrThrow({ where: { id }, include: { analyses: true } });
      if (requirement.status === "VALIDATED") return this.toRecord(requirement);
      if (requirement.status === "REJECTED") throw new RequirementValidationBlockedError("Requisito rejeitado não pode ser validado sem revisão.");
      if (requirement.analyses.length === 0) throw new RequirementValidationBlockedError("O requisito exige ao menos uma análise humana antes da validação.");
      if (requirement.analyses.some(analysis => analysis.status !== "VALIDATED")) throw new RequirementValidationBlockedError("Todas as análises do requisito devem estar validadas.");
      const nextVersion = requirement.version + 1;
      const changed = await transaction.tenderRequirement.updateMany({ where: { id, version: requirement.version, status: { in: ["DRAFT", "PENDING_VALIDATION"] } }, data: { status: "VALIDATED", version: nextVersion, updatedBy: actorId } });
      if (changed.count !== 1) throw new RequirementConcurrencyError(id);
      await transaction.requirementHistory.create({ data: { id: randomUUID(), requirementId: id, version: nextVersion, action: "VALIDATED", changes: { status: { from: requirement.status, to: "VALIDATED" }, analyses: requirement.analyses.map(analysis => ({ id: analysis.id, competence: analysis.competence, status: analysis.status, version: analysis.version })) }, changedById: actorId, correlationId } });
      await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId, action: "REQUIREMENT_VALIDATED", entityType: "TENDER_REQUIREMENT", entityId: id, correlationId, outcome: "SUCCESS", origin: "requirement-service", metadata: { version: nextVersion, analyses: requirement.analyses.length, justification } } });
      return this.toRecord(await transaction.tenderRequirement.findUniqueOrThrow({ where: { id } }));
    });
  }

  private toRecord(value: TenderRequirement): RequirementRecord {
    return { id: value.id, tenderVersionId: value.tenderVersionId, type: value.type, text: value.text, criticality: value.criticality, responsibleId: value.responsibleId, sourceExcerpt: value.sourceExcerpt, sourcePage: value.sourcePage, status: value.status, version: value.version };
  }
}
