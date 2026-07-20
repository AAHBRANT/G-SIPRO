import { randomUUID } from "node:crypto";
import { proposalDraftSchema, proposalVersionSchema, type ProposalDraft, type ProposalVersionDraft } from "@/modules/proposals/domain/proposal";

export type ProposalRecord = Readonly<{ id: string; code: string; title: string; version: number; status: string; originType: string; opportunity: { id: string; code: string; version: number; subject: string | null; deliveryAt: Date | null; closureReasonCode: string | null }; tender: { id: string; code: string; number: string; versionId: string; version: number; fileName: string; fileHash: string; lotId: string; lotCode: string; lotSubject: string } | null; versions: ReadonlyArray<{ id: string; version: number; reason: string; createdAt: Date; components: ReadonlyArray<{ id: string; type: string; status: string }> }>; createdAt: Date }>;
export interface ProposalRepository { create(draft: ProposalDraft, actorId: string, correlationId: string): Promise<ProposalRecord>; createVersion(id: string, draft: ProposalVersionDraft, actorId: string, correlationId: string): Promise<ProposalRecord>; list(actorId: string, correlationId: string): Promise<ReadonlyArray<ProposalRecord>>; }

export class ProposalService {
  constructor(private readonly repository: ProposalRepository) {}
  create(input: unknown, actorId: string, correlationId: string = randomUUID()) { return this.repository.create(proposalDraftSchema.parse(input), actorId, correlationId); }
  createVersion(id: string, input: unknown, actorId: string, correlationId: string = randomUUID()) { return this.repository.createVersion(id, proposalVersionSchema.parse(input), actorId, correlationId); }
  list(actorId: string, correlationId: string = randomUUID()) { return this.repository.list(actorId, correlationId); }
}
