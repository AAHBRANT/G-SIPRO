import { randomUUID } from "node:crypto";
import { getDatabase } from "@/core/database/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { ProposalRecord, ProposalRepository } from "@/modules/proposals/application/proposal-service";
import type { ProposalDraft } from "@/modules/proposals/domain/proposal";
import type { ProposalVersionDraft } from "@/modules/proposals/domain/proposal";

export class ProposalOpportunityNotFoundError extends Error { constructor() { super("Oportunidade não encontrada."); this.name = "ProposalOpportunityNotFoundError"; } }
export class ProposalNotFoundError extends Error { constructor() { super("Proposta não encontrada."); this.name = "ProposalNotFoundError"; } }
export class ProposalTenderNotFoundError extends Error { constructor() { super("Versão do edital ou lote não encontrado."); this.name = "ProposalTenderNotFoundError"; } }
export class ProposalOriginRuleError extends Error { constructor(message: string) { super(message); this.name = "ProposalOriginRuleError"; } }

const proposalInclude = { opportunity: true, tenderVersion: { include: { tender: true } }, tenderLot: true, versions: { include: { components: { orderBy: { type: "asc" as const } } }, orderBy: { version: "desc" as const } } };
type ProposalWithOrigin = Prisma.ProposalGetPayload<{ include: typeof proposalInclude }>;

export class PrismaProposalRepository implements ProposalRepository {
  async create(draft: ProposalDraft, actorId: string, correlationId: string) {
    return getDatabase().$transaction(async transaction => {
      const opportunity = await transaction.opportunity.findUnique({ where: { id: draft.opportunityId }, include: { tenders: { select: { id: true } } } });
      if (!opportunity) throw new ProposalOpportunityNotFoundError();
      if (opportunity.status !== "ACTIVE" || !opportunity.ownerId) throw new ProposalOriginRuleError("A proposta só pode ser criada após a validação e delegação da oportunidade.");
      if (await transaction.proposal.findFirst({ where: { opportunityId: opportunity.id, deletedAt: null }, select: { id: true } })) throw new ProposalOriginRuleError("Esta oportunidade já foi convertida em proposta.");
      const originType = draft.originType ?? (opportunity.tenders.length > 0 ? "PUBLIC_TENDER" : "DIRECT");
      const requiresTender = originType === "PUBLIC_TENDER";
      if (!requiresTender && (draft.tenderVersionId || draft.tenderLotId)) throw new ProposalOriginRuleError("A oportunidade não possui edital vinculado.");
      let tender: { version: number; fileHash: string; tender: { id: string; opportunityId: string | null }; fileName: string } | null = null;
      let lot: { id: string; tenderId: string; code: string } | null = null;
      if (draft.tenderVersionId && draft.tenderLotId) {
        [tender, lot] = await Promise.all([transaction.tenderVersion.findUnique({ where: { id: draft.tenderVersionId }, include: { tender: true } }), transaction.tenderLot.findUnique({ where: { id: draft.tenderLotId } })]);
        if (!tender || !lot) throw new ProposalTenderNotFoundError();
        if (tender.tender.opportunityId !== opportunity.id || lot.tenderId !== tender.tender.id) throw new ProposalOriginRuleError("A versão do edital e o lote devem pertencer à oportunidade e ao mesmo edital.");
      }
      const proposal = await transaction.proposal.create({ data: { id: randomUUID(), code: draft.code, title: draft.title ?? opportunity.subject ?? draft.code, opportunityId: opportunity.id, opportunityVersion: opportunity.version, originType, tenderVersionId: draft.tenderVersionId, tenderVersionNumber: tender?.version, tenderFileHash: tender?.fileHash, tenderLotId: draft.tenderLotId, tenderLotCode: lot?.code, version: 1, status: "PREPARATION", createdBy: actorId, updatedBy: actorId } });
      const versionId=randomUUID();
      await transaction.proposalVersion.create({data:{id:versionId,proposalId:proposal.id,version:1,reason:"Versão inicial criada com o cadastro da proposta.",createdBy:actorId,correlationId}});
      await transaction.proposalComponent.createMany({data:[{id:randomUUID(),proposalVersionId:versionId,type:"TECHNICAL",status:"DRAFT",createdBy:actorId},{id:randomUUID(),proposalVersionId:versionId,type:"COMMERCIAL",status:"DRAFT",createdBy:actorId}]});
      const snapshot = { code: proposal.code, version: 1, status: "PREPARATION", opportunityId: opportunity.id, opportunityCode: opportunity.code, opportunityVersion: opportunity.version, tenderVersionId: proposal.tenderVersionId, tenderVersion: proposal.tenderVersionNumber, tenderFileHash: proposal.tenderFileHash, tenderLotId: proposal.tenderLotId, tenderLotCode: proposal.tenderLotCode };
      await transaction.proposalHistory.create({ data: { id: randomUUID(), proposalId: proposal.id, version: 1, action: "CREATED", snapshot, changedById: actorId, correlationId } });
      const inheritedLinks = await transaction.managedDocumentLink.findMany({ where: { entityType: "OPPORTUNITY", entityId: opportunity.id, role: "SOURCE_DOCUMENT" }, select: { documentId: true } });
      if (inheritedLinks.length) await transaction.managedDocumentLink.createMany({ data: inheritedLinks.map(link => ({ id: randomUUID(), documentId: link.documentId, entityType: "PROPOSAL", entityId: proposal.id, role: "SOURCE_DOCUMENT", createdBy: actorId })), skipDuplicates: true });
      await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId, action: "PROPOSAL_CREATED", entityType: "PROPOSAL", entityId: proposal.id, correlationId, outcome: "SUCCESS", origin: "proposal-service", metadata: snapshot } });
      return this.findRecord(transaction, proposal.id);
    });
  }

  async createVersion(id: string,draft: ProposalVersionDraft,actorId: string,correlationId: string){return getDatabase().$transaction(async transaction=>{const proposal=await transaction.proposal.findUnique({where:{id},include:{versions:{orderBy:{version:"desc"},take:1}}});if(!proposal)throw new ProposalNotFoundError();const previous=proposal.versions[0];if(!previous)throw new ProposalOriginRuleError("A proposta não possui versão inicial.");const next=proposal.version+1;const versionId=randomUUID();await transaction.proposalVersion.create({data:{id:versionId,proposalId:id,version:next,previousVersionId:previous.id,reason:draft.reason,createdBy:actorId,correlationId}});await transaction.proposalComponent.createMany({data:[{id:randomUUID(),proposalVersionId:versionId,type:"TECHNICAL",status:"DRAFT",createdBy:actorId},{id:randomUUID(),proposalVersionId:versionId,type:"COMMERCIAL",status:"DRAFT",createdBy:actorId}]});await transaction.proposal.update({where:{id},data:{version:next,status:"PREPARATION",updatedBy:actorId}});await transaction.proposalHistory.create({data:{id:randomUUID(),proposalId:id,version:next,action:"VERSION_CREATED",snapshot:{version:next,previousVersionId:previous.id,reason:draft.reason,components:["TECHNICAL","COMMERCIAL"],status:"PREPARATION"},changedById:actorId,correlationId}});await transaction.auditEvent.create({data:{id:randomUUID(),actorType:"USER",actorId,action:"PROPOSAL_VERSION_CREATED",entityType:"PROPOSAL",entityId:id,correlationId,outcome:"SUCCESS",origin:"proposal-service",metadata:{version:next,previousVersionId:previous.id,reason:draft.reason}}});return this.findRecord(transaction,id)});}

  async list(actorId: string, correlationId: string) {
    const database = getDatabase();
    const proposals = await database.proposal.findMany({ where: { deletedAt: null }, include: proposalInclude, orderBy: { createdAt: "desc" } });
    await database.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId, action: "PROPOSALS_ACCESSED", entityType: "PROPOSAL_COLLECTION", entityId: "proposals", correlationId, outcome: "SUCCESS", origin: "proposal-service", metadata: { records: proposals.length } } });
    return proposals.map(item => this.toRecord(item));
  }

  private async findRecord(transaction: Prisma.TransactionClient, id: string) { return this.toRecord(await transaction.proposal.findUniqueOrThrow({ where: { id }, include: proposalInclude })); }
  private toRecord(proposal: ProposalWithOrigin): ProposalRecord {
    return { id: proposal.id, code: proposal.code, title: proposal.title, version: proposal.version, status: proposal.status, originType: proposal.originType, opportunity: { id: proposal.opportunity.id, code: proposal.opportunity.code, version: proposal.opportunityVersion, subject: proposal.opportunity.subject, deliveryAt: proposal.opportunity.deliveryAt, closureReasonCode: proposal.opportunity.closureReasonCode }, tender: proposal.tenderVersion && proposal.tenderLot ? { id: proposal.tenderVersion.tender.id, code: proposal.tenderVersion.tender.code, number: proposal.tenderVersion.tender.number, versionId: proposal.tenderVersion.id, version: proposal.tenderVersionNumber!, fileName: proposal.tenderVersion.fileName, fileHash: proposal.tenderFileHash!, lotId: proposal.tenderLot.id, lotCode: proposal.tenderLotCode!, lotSubject: proposal.tenderLot.subject } : null, versions:proposal.versions.map(version=>({id:version.id,version:version.version,reason:version.reason,createdAt:version.createdAt,components:version.components.map(component=>({id:component.id,type:component.type,status:component.status}))})), createdAt: proposal.createdAt };
  }
}
