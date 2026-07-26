import { randomUUID } from "node:crypto";
import { z } from "zod";

const inputSchema = z.object({ documentVersionId: z.uuid() }).strict();

export type ProposalTenderLinkRecord = Readonly<{
  tenderId: string;
  tenderVersionId: string;
  tenderLotId: string;
  code: string;
  reused: boolean;
}>;

export interface ProposalTenderLinkRepository {
  promote(
    proposalId: string,
    documentVersionId: string,
    actorId: string,
    correlationId: string,
  ): Promise<ProposalTenderLinkRecord>;
}

export class ProposalTenderLinkService {
  constructor(private readonly repository: ProposalTenderLinkRepository) {}

  promote(
    proposalId: string,
    input: unknown,
    actorId: string,
    correlationId: string = randomUUID(),
  ) {
    return this.repository.promote(
      z.uuid().parse(proposalId),
      inputSchema.parse(input).documentVersionId,
      actorId,
      correlationId,
    );
  }
}
