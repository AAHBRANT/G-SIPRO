import { randomUUID } from "node:crypto";
import { getDatabase } from "@/core/database/prisma";
import type {
  ProposalTenderLinkRecord,
  ProposalTenderLinkRepository,
} from "@/modules/proposal-tender-link/application/proposal-tender-link-service";

export class ProposalTenderLinkNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalTenderLinkNotFoundError";
  }
}

export class ProposalTenderLinkRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalTenderLinkRuleError";
  }
}

export class PrismaProposalTenderLinkRepository implements ProposalTenderLinkRepository {
  async promote(
    proposalId: string,
    documentVersionId: string,
    actorId: string,
    correlationId: string,
  ): Promise<ProposalTenderLinkRecord> {
    return getDatabase().$transaction(async (transaction) => {
      const proposal = await transaction.proposal.findFirst({
        where: { id: proposalId, deletedAt: null },
        include: {
          opportunity: true,
          tenderVersion: { include: { tender: { include: { lots: true } } } },
          tenderLot: true,
        },
      });
      if (!proposal) throw new ProposalTenderLinkNotFoundError("Proposta não encontrada.");

      if (proposal.tenderVersion && proposal.tenderLot) {
        return {
          tenderId: proposal.tenderVersion.tender.id,
          tenderVersionId: proposal.tenderVersion.id,
          tenderLotId: proposal.tenderLot.id,
          code: proposal.tenderVersion.tender.code,
          reused: true,
        };
      }

      const source = await transaction.managedDocumentVersion.findFirst({
        where: {
          id: documentVersionId,
          document: {
            type: "EDITAL",
            links: {
              some: {
                entityType: "PROPOSAL",
                entityId: proposalId,
                role: "SOURCE_DOCUMENT",
              },
            },
          },
        },
        include: { document: true },
      });
      if (!source) {
        throw new ProposalTenderLinkRuleError(
          "Selecione uma versão de EDITAL vinculada a esta proposta.",
        );
      }

      let tenderVersion = await transaction.tenderVersion.findFirst({
        where: {
          fileHash: source.fileHash,
          tender: { opportunityId: proposal.opportunityId },
        },
        include: { tender: { include: { lots: true } } },
      });
      const reused = Boolean(tenderVersion);

      if (!tenderVersion) {
        const baseCode = `EDT-${proposal.code}`.slice(0, 50);
        const occupied = await transaction.tender.findUnique({ where: { code: baseCode } });
        const code = occupied
          ? `${baseCode.slice(0, 43)}-${source.fileHash.slice(0, 6)}`.slice(0, 50)
          : baseCode;
        const tenderId = randomUUID();
        const versionId = randomUUID();
        const lotId = randomUUID();
        const modality =
          proposal.originType === "PRIVATE_COMPETITION"
            ? "Concorrência privada"
            : "Concorrência pública";

        await transaction.tender.create({
          data: {
            id: tenderId,
            code,
            number: proposal.code,
            modality,
            subject: proposal.opportunity.subject ?? proposal.title,
            origin: source.origin,
            opportunityId: proposal.opportunityId,
            contractingAuthorityId: proposal.opportunity.contractingAuthorityId,
            createdBy: actorId,
            updatedBy: actorId,
            lots: {
              create: {
                id: lotId,
                code: "LOTE-UNICO",
                subject: proposal.opportunity.subject ?? proposal.title,
                createdBy: actorId,
                updatedBy: actorId,
              },
            },
            versions: {
              create: {
                id: versionId,
                version: 1,
                fileName: source.document.title,
                fileHash: source.fileHash,
                uri: source.uri,
                mimeType: source.mimeType,
                sizeBytes: source.sizeBytes,
                source: source.origin,
                receivedAt: source.createdAt,
                createdBy: actorId,
              },
            },
          },
        });

        tenderVersion = await transaction.tenderVersion.findUniqueOrThrow({
          where: { id: versionId },
          include: { tender: { include: { lots: true } } },
        });

        await transaction.managedDocumentLink.upsert({
          where: {
            documentId_entityType_entityId_role: {
              documentId: source.documentId,
              entityType: "TENDER",
              entityId: tenderId,
              role: "SOURCE_DOCUMENT",
            },
          },
          create: {
            id: randomUUID(),
            documentId: source.documentId,
            entityType: "TENDER",
            entityId: tenderId,
            role: "SOURCE_DOCUMENT",
            createdBy: actorId,
          },
          update: {},
        });

        await transaction.auditEvent.create({
          data: {
            id: randomUUID(),
            actorType: "USER",
            actorId,
            action: "TENDER_CREATED_FROM_PROPOSAL_DOCUMENT",
            entityType: "TENDER",
            entityId: tenderId,
            correlationId,
            outcome: "SUCCESS",
            origin: "proposal-tender-link",
            metadata: {
              proposalId,
              opportunityId: proposal.opportunityId,
              managedDocumentVersionId: source.id,
              fileHash: source.fileHash,
              originalPreserved: true,
            },
          },
        });
      }

      const lot =
        tenderVersion.tender.lots[0] ??
        (await transaction.tenderLot.create({
          data: {
            id: randomUUID(),
            tenderId: tenderVersion.tender.id,
            code: "LOTE-UNICO",
            subject: proposal.opportunity.subject ?? proposal.title,
            createdBy: actorId,
            updatedBy: actorId,
          },
        }));

      await transaction.proposal.update({
        where: { id: proposal.id },
        data: {
          originType:
            proposal.originType === "DIRECT" ? "PUBLIC_TENDER" : proposal.originType,
          tenderVersionId: tenderVersion.id,
          tenderVersionNumber: tenderVersion.version,
          tenderFileHash: tenderVersion.fileHash,
          tenderLotId: lot.id,
          tenderLotCode: lot.code,
          updatedBy: actorId,
        },
      });

      await transaction.auditEvent.create({
        data: {
          id: randomUUID(),
          actorType: "USER",
          actorId,
          action: "PROPOSAL_TENDER_LINKED",
          entityType: "PROPOSAL",
          entityId: proposal.id,
          correlationId,
          outcome: "SUCCESS",
          origin: "proposal-tender-link",
          metadata: {
            tenderId: tenderVersion.tender.id,
            tenderVersionId: tenderVersion.id,
            tenderLotId: lot.id,
            fileHash: tenderVersion.fileHash,
            reused,
          },
        },
      });

      return {
        tenderId: tenderVersion.tender.id,
        tenderVersionId: tenderVersion.id,
        tenderLotId: lot.id,
        code: tenderVersion.tender.code,
        reused,
      };
    });
  }
}
