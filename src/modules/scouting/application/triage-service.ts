import { z } from "zod";

export const scoutedTenderStatuses = ["PENDING", "APPROVED", "DISCARDED", "EXPIRED"] as const;
export type ScoutedTenderStatus = (typeof scoutedTenderStatuses)[number];

export const discardReasonSchema = z.string().trim().min(3).max(1_000);

export type ScoutedTenderRecord = Readonly<{
  id: string;
  externalId: string;
  subject: string;
  authorityName: string;
  authorityDocument?: string;
  city?: string;
  state?: string;
  estimatedValue?: number;
  valueUndisclosed: boolean;
  proposalClosesAt?: Date;
  noticeUrl?: string;
  status: ScoutedTenderStatus;
}>;

/**
 * Dados com que a oportunidade nasce quando a licitação é aprovada na triagem.
 * O responsável é o usuário que aprovou — a autoria da automação fica
 * registrada na origem, não no responsável.
 */
export type OpportunitySeed = Readonly<{
  subject: string;
  authorityName: string;
  authorityDocument?: string;
  estimatedValue?: number;
  deliveryAt?: Date;
  ownerId: string;
}>;

export interface TriageRepository {
  findById(id: string): Promise<ScoutedTenderRecord | null>;
  markApproved(id: string, opportunityId: string, actorId: string, decidedAt: Date): Promise<void>;
  markDiscarded(id: string, actorId: string, reason: string, decidedAt: Date): Promise<void>;
  countPending(): Promise<number>;
}

export interface OpportunityCreationPort {
  /** Cria a oportunidade com origem BUSCADOR e status "Em análise" (QUALIFICATION). */
  createFromScoutedTender(seed: OpportunitySeed, actorId: string, correlationId: string): Promise<string>;
}

export class ScoutedTenderNotFoundError extends Error {
  constructor(id: string) {
    super(`Licitação rastreada não encontrada: ${id}`);
    this.name = "ScoutedTenderNotFoundError";
  }
}

export class ScoutedTenderAlreadyDecidedError extends Error {
  constructor(status: ScoutedTenderStatus) {
    super(`Esta licitação já foi triada (${status}).`);
    this.name = "ScoutedTenderAlreadyDecidedError";
  }
}

/**
 * Triagem humana da fila: aprovar converte a licitação em oportunidade do
 * G-SIPRO com os dados já preenchidos; descartar preserva o registro no
 * histórico, com autor e motivo, e impede que a licitação volte à fila.
 */
export class TriageService {
  constructor(
    private readonly repository: TriageRepository,
    private readonly opportunities: OpportunityCreationPort,
  ) {}

  private async requirePending(id: string): Promise<ScoutedTenderRecord> {
    const record = await this.repository.findById(id);
    if (!record) throw new ScoutedTenderNotFoundError(id);
    if (record.status !== "PENDING") throw new ScoutedTenderAlreadyDecidedError(record.status);
    return record;
  }

  async approve(id: string, actorId: string, correlationId: string, decidedAt: Date = new Date()): Promise<string> {
    const record = await this.requirePending(id);
    const opportunityId = await this.opportunities.createFromScoutedTender(
      {
        subject: record.subject,
        authorityName: record.authorityName,
        authorityDocument: record.authorityDocument,
        estimatedValue: record.estimatedValue,
        deliveryAt: record.proposalClosesAt,
        ownerId: actorId,
      },
      actorId,
      correlationId,
    );
    await this.repository.markApproved(id, opportunityId, actorId, decidedAt);
    return opportunityId;
  }

  async discard(id: string, actorId: string, reason: unknown, decidedAt: Date = new Date()): Promise<void> {
    await this.requirePending(id);
    await this.repository.markDiscarded(id, actorId, discardReasonSchema.parse(reason), decidedAt);
  }

  /** Quantidade que alimenta o aviso na barra lateral e o card da tela. */
  async pendingCount(): Promise<number> {
    return this.repository.countPending();
  }
}
