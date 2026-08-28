import { resolveSignal, type ResolvedSignal, type SignalCommand, type SignalLevel } from "@/modules/scouting/domain/signal";

/**
 * Sinalização da fila de triagem: fincar, trocar e remover a marca colorida de
 * uma licitação rastreada.
 *
 * A marca é uma por licitação, não uma por pessoa. Ela existe para orientar
 * quem abrir a fila depois — duas marcas concorrentes na mesma linha só
 * confundiriam. Sinalizar de novo substitui a marca anterior e registra o novo
 * autor.
 */

export type SignalRecord = Readonly<{
  tenderId: string;
  level: SignalLevel;
  label: string;
  color: string;
  note?: string;
  signaledById: string;
  signaledAt: Date;
}>;

export interface SignalRepository {
  /** Confere se a licitação existe e se ainda está na fila. */
  findTenderStatus(tenderId: string): Promise<{ status: string } | null>;
  save(record: SignalRecord): Promise<void>;
  remove(tenderId: string): Promise<boolean>;
}

export class TenderNotFoundError extends Error {
  constructor(id: string) {
    super(`Licitação rastreada não encontrada: ${id}`);
    this.name = "TenderNotFoundError";
  }
}

export class TenderAlreadyDecidedError extends Error {
  constructor(status: string) {
    super(`Esta licitação já saiu da fila (${status}) e não pode ser sinalizada.`);
    this.name = "TenderAlreadyDecidedError";
  }
}

export class SignalNotFoundError extends Error {
  constructor(id: string) {
    super(`Esta licitação não está sinalizada: ${id}`);
    this.name = "SignalNotFoundError";
  }
}

export class SignalService {
  constructor(
    private readonly repository: SignalRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * Finca ou substitui a marca. Devolve a sinalização já resolvida, com as duas
   * variantes de cor, para quem chamou poder desenhar sem consultar de novo.
   */
  async signal(tenderId: string, command: SignalCommand, actorId: string): Promise<ResolvedSignal> {
    const tender = await this.repository.findTenderStatus(tenderId);
    if (!tender) throw new TenderNotFoundError(tenderId);
    // Sinalizar o que já foi aprovado ou descartado não orienta ninguém: a
    // licitação não aparece mais na fila.
    if (tender.status !== "PENDING") throw new TenderAlreadyDecidedError(tender.status);

    const resolved = resolveSignal(command);
    await this.repository.save({
      tenderId,
      level: resolved.level,
      label: resolved.label,
      color: resolved.color,
      ...(resolved.note ? { note: resolved.note } : {}),
      signaledById: actorId,
      signaledAt: this.now(),
    });
    return resolved;
  }

  /** Tira a marca. Remover o que não existe é erro, não silêncio. */
  async unsignal(tenderId: string): Promise<void> {
    const removed = await this.repository.remove(tenderId);
    if (!removed) throw new SignalNotFoundError(tenderId);
  }
}
