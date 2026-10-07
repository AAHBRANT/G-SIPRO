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
  /** Esfera como o PNCP entrega: uma letra (F, E, M, D). */
  sphere?: string;
  city?: string;
  state?: string;
  estimatedValue?: number;
  valueUndisclosed: boolean;
  proposalOpensAt?: Date;
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
  /** Letra da esfera e localidade: é com elas que o órgão nasce cadastrado. */
  sphere?: string;
  city?: string;
  state?: string;
  estimatedValue?: number;
  publishedAt?: Date;
  deliveryAt?: Date;
  ownerId: string;
}>;

export interface TriageRepository {
  findById(id: string): Promise<ScoutedTenderRecord | null>;
  /**
   * Passa a licitação de PENDING para APPROVED numa única escrita condicional.
   * Devolve `false` quando ela já não estava pendente — outra aprovação,
   * descarte ou expiração chegou antes. É esta trava, e não a leitura anterior,
   * que impede a mesma licitação de gerar duas oportunidades.
   */
  claimForApproval(id: string, actorId: string, decidedAt: Date): Promise<boolean>;
  /** Vincula a oportunidade criada à licitação já travada como aprovada. */
  linkOpportunity(id: string, opportunityId: string): Promise<void>;
  /** Desfaz a trava quando a oportunidade não chegou a ser criada. */
  releaseApproval(id: string): Promise<void>;
  /**
   * `actorId` ausente quando o descarte é automático (duplicata resolvida pela
   * varredura). Devolve `false` quando a licitação já não estava pendente.
   */
  markDiscarded(id: string, actorId: string | undefined, reason: string, decidedAt: Date): Promise<boolean>;
  /**
   * Outras publicações da MESMA obra (regra de `findDuplicates`): as que ainda
   * estão na fila e as que já viraram oportunidade.
   */
  findTwins(id: string): Promise<TwinTenders>;
  countPending(): Promise<number>;
}

export type TwinTenders = Readonly<{
  pending: readonly string[];
  approved: readonly Readonly<{ id: string; opportunityId: string }>[];
}>;

export type ApprovalOutcome = Readonly<{
  opportunityId: string;
  /**
   * Verdadeiro quando a mesma obra já tinha sido aprovada por outra
   * publicação: nenhuma oportunidade nova foi criada, esta publicação foi
   * descartada como duplicata e `opportunityId` é a que já existia.
   */
  reaproveitada: boolean;
}>;

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

  async approve(id: string, actorId: string, correlationId: string, decidedAt: Date = new Date()): Promise<ApprovalOutcome> {
    const record = await this.requirePending(id);
    const twins = await this.repository.findTwins(id);

    // A mesma obra já virou oportunidade por outra publicação (o órgão
    // republicou depois de uma retificação, por exemplo). Aprovar de novo
    // criaria a segunda oportunidade e a segunda ficha da mesma obra — o
    // sintoma relatado em 07/10/2026. Em vez disso, esta publicação sai da
    // fila como duplicata e a pessoa vai para a oportunidade que já existe.
    const existente = twins.approved[0];
    if (existente) {
      const reason = `Duplicata: mesma obra já aprovada pela licitação ${existente.id}.`;
      if (!(await this.repository.markDiscarded(id, actorId, reason, decidedAt))) {
        throw new ScoutedTenderAlreadyDecidedError("DISCARDED");
      }
      return { opportunityId: existente.opportunityId, reaproveitada: true };
    }

    // Trava ANTES de criar a oportunidade. Até 05/10/2026 a licitação só era
    // marcada aprovada no fim, e continuava na fila oferecendo Aprovar e
    // Descartar de novo — cada nova aprovação criava mais uma oportunidade.
    if (!(await this.repository.claimForApproval(id, actorId, decidedAt))) {
      throw new ScoutedTenderAlreadyDecidedError("APPROVED");
    }
    let opportunityId: string;
    try {
      opportunityId = await this.opportunities.createFromScoutedTender(
        {
          subject: record.subject,
          authorityName: record.authorityName,
          authorityDocument: record.authorityDocument,
          sphere: record.sphere,
          city: record.city,
          state: record.state,
          estimatedValue: record.estimatedValue,
          publishedAt: record.proposalOpensAt,
          deliveryAt: record.proposalClosesAt,
          ownerId: actorId,
        },
        actorId,
        correlationId,
      );
    } catch (error) {
      // A oportunidade não nasceu: a licitação volta para a fila.
      await this.repository.releaseApproval(id);
      throw error;
    }
    await this.repository.linkOpportunity(id, opportunityId);

    // As outras publicações da mesma obra que ainda estão na fila saem junto:
    // deixá-las lá é o que fazia "a mesma licitação" continuar aparecendo,
    // agora sem o aviso de duplicata (o par aprovado não entra mais na conta
    // da fila). `false` aqui é corrida com outra decisão — a dela vale.
    for (const twin of twins.pending) {
      await this.repository.markDiscarded(twin, undefined, `Duplicata automática: mesma obra que a licitação ${id}, aprovada.`, decidedAt);
    }
    return { opportunityId, reaproveitada: false };
  }

  async discard(id: string, actorId: string | undefined, reason: unknown, decidedAt: Date = new Date()): Promise<void> {
    await this.requirePending(id);
    const discarded = await this.repository.markDiscarded(id, actorId, discardReasonSchema.parse(reason), decidedAt);
    if (!discarded) throw new ScoutedTenderAlreadyDecidedError("DISCARDED");
  }

  /** Quantidade que alimenta o aviso na barra lateral e o card da tela. */
  async pendingCount(): Promise<number> {
    return this.repository.countPending();
  }
}
