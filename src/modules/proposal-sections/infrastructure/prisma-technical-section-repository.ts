import { randomUUID } from "node:crypto";
import { getDatabase } from "@/core/database/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { TechnicalSectionRecord, TechnicalSectionRepository } from "@/modules/proposal-sections/application/technical-section-service";
import type { TechnicalSectionDraft, TechnicalSectionUpdate } from "@/modules/proposal-sections/domain/technical-section";

export class TechnicalSectionNotFoundError extends Error { constructor(message = "Proposta ou seção técnica não encontrada.") { super(message); this.name = "TechnicalSectionNotFoundError"; } }
export class TechnicalSectionRuleError extends Error { constructor(message: string) { super(message); this.name = "TechnicalSectionRuleError"; } }
export class TechnicalSectionConflictError extends Error { constructor() { super("A seção foi alterada por outro usuário. Atualize a tela e tente novamente."); this.name = "TechnicalSectionConflictError"; } }

const include = { responsible: true, requirements: { include: { requirement: true }, orderBy: { sourcePage: "asc" as const } } };
type SectionWithRelations = Prisma.ProposalTechnicalSectionGetPayload<{ include: typeof include }>;

export class PrismaTechnicalSectionRepository implements TechnicalSectionRepository {
  async create(proposalId: string, draft: TechnicalSectionDraft, actorId: string, correlationId: string) {
    return getDatabase().$transaction(async tx => {
      const proposal = await tx.proposal.findUnique({ where: { id: proposalId } });
      if (!proposal) throw new TechnicalSectionNotFoundError();
      const current = await tx.proposalVersion.findUnique({ where: { proposalId_version: { proposalId, version: proposal.version } }, include: { components: true } });
      const component = current?.components.find(item => item.type === "TECHNICAL");
      if (!component) throw new TechnicalSectionRuleError("A versão atual não possui componente técnico.");
      const responsible = await tx.user.findFirst({ where: { id: draft.responsibleId, status: "ACTIVE" } });
      if (!responsible) throw new TechnicalSectionRuleError("O responsável técnico deve ser um usuário ativo.");
      const requirements = draft.requirementIds.length ? await tx.tenderRequirement.findMany({ where: { id: { in: draft.requirementIds }, status: "VALIDATED" } }) : [];
      if (requirements.length !== new Set(draft.requirementIds).size) throw new TechnicalSectionRuleError("Todos os requisitos vinculados devem existir e estar validados.");
      if (requirements.some(item => item.tenderVersionId !== proposal.tenderVersionId)) throw new TechnicalSectionRuleError("Os requisitos devem pertencer à versão documental vinculada à proposta.");
      const section = await tx.proposalTechnicalSection.create({ data: { id: randomUUID(), componentId: component.id, type: draft.type, title: draft.title, position: draft.position, responsibleId: responsible.id, status: "DRAFT", version: 1, createdBy: actorId, updatedBy: actorId, requirements: { create: requirements.map(item => ({ requirementId: item.id, requirementVersion: item.version, requirementType: item.type, requirementText: item.text, sourceExcerpt: item.sourceExcerpt, sourcePage: item.sourcePage, createdBy: actorId })) } }, include });
      const snapshot = { type: section.type, title: section.title, position: section.position, responsibleId: section.responsibleId, status: section.status, requirementIds: requirements.map(item => item.id) };
      await tx.proposalTechnicalSectionHistory.create({ data: { id: randomUUID(), sectionId: section.id, version: 1, action: "CREATED", snapshot, changedById: actorId, correlationId } });
      await tx.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId, action: "PROPOSAL_TECHNICAL_SECTION_CREATED", entityType: "PROPOSAL_TECHNICAL_SECTION", entityId: section.id, correlationId, outcome: "SUCCESS", origin: "proposal-section-service", metadata: { proposalId, proposalVersion: proposal.version, ...snapshot } } });
      return this.toRecord(section);
    });
  }
  async update(proposalId: string, sectionId: string, draft: TechnicalSectionUpdate, actorId: string, correlationId: string) {
    return getDatabase().$transaction(async tx => {
      if (draft.status === "COMPLETED") throw new TechnicalSectionRuleError("A conclusão da seção ocorre somente por revisão técnica aprovada.");
      const before = await tx.proposalTechnicalSection.findUnique({ where: { id: sectionId }, include: { component: { include: { proposalVersion: { include: { proposal: true } } } } } });
      if (!before || before.component.proposalVersion.proposalId !== proposalId) throw new TechnicalSectionNotFoundError();
      if (before.component.proposalVersion.version !== before.component.proposalVersion.proposal.version) throw new TechnicalSectionRuleError("Somente seções da versão atual podem ser alteradas.");
      const responsible = await tx.user.findFirst({ where: { id: draft.responsibleId, status: "ACTIVE" } });
      if (!responsible) throw new TechnicalSectionRuleError("O responsável técnico deve ser um usuário ativo.");
      const changed = await tx.proposalTechnicalSection.updateMany({ where: { id: sectionId, version: draft.version }, data: { responsibleId: draft.responsibleId, status: draft.status, version: { increment: 1 }, updatedBy: actorId } });
      if (changed.count !== 1) throw new TechnicalSectionConflictError();
      const section = await tx.proposalTechnicalSection.findUniqueOrThrow({ where: { id: sectionId }, include });
      const snapshot = { responsibleId: section.responsibleId, status: section.status, previousResponsibleId: before.responsibleId, previousStatus: before.status };
      await tx.proposalTechnicalSectionHistory.create({ data: { id: randomUUID(), sectionId, version: section.version, action: "ASSIGNMENT_STATUS_UPDATED", snapshot, changedById: actorId, correlationId } });
      await tx.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId, action: "PROPOSAL_TECHNICAL_SECTION_UPDATED", entityType: "PROPOSAL_TECHNICAL_SECTION", entityId: sectionId, correlationId, outcome: "SUCCESS", origin: "proposal-section-service", metadata: { proposalId, ...snapshot } } });
      return this.toRecord(section);
    });
  }
  private toRecord(section: SectionWithRelations): TechnicalSectionRecord { return { id: section.id, componentId: section.componentId, type: section.type, title: section.title, position: section.position, status: section.status, version: section.version, responsible: { id: section.responsible.id, name: section.responsible.displayName }, requirements: section.requirements.map(link => ({ id: link.requirementId, version: link.requirementVersion, type: link.requirementType, text: link.requirementText, sourcePage: link.sourcePage })), createdAt: section.createdAt, updatedAt: section.updatedAt }; }
}
