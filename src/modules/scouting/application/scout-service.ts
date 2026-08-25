import { qualify, type CandidateTender } from "@/modules/scouting/domain/qualification";
import { defaultScoutFilter, type ScoutFilter, type ScoutWorkType } from "@/modules/scouting/domain/scout-filter";
import type { PncpTender } from "@/modules/scouting/infrastructure/pncp-client";

export type ScoutRunTrigger = "SCHEDULED" | "MANUAL";

/**
 * Licitação aprovada no Estágio 1, junto com os tipos de obra reconhecidos no
 * objeto — que a fila usa depois para filtrar por ramo.
 */
export type QualifiedTender = PncpTender & { workTypes: readonly ScoutWorkType[] };

export type ScoutRunSummary = Readonly<{
  runId: string;
  totalFetched: number;
  totalQualified: number;
  totalNew: number;
  failures?: readonly string[];
}>;

export interface ScoutRepository {
  loadFilter(): Promise<ScoutFilter | null>;
  startRun(trigger: ScoutRunTrigger): Promise<string>;
  /** Devolve, entre os identificadores informados, os que já foram triados ou já estão na fila. */
  findKnownExternalIds(externalIds: readonly string[]): Promise<readonly string[]>;
  saveScoutedTenders(runId: string, tenders: readonly QualifiedTender[]): Promise<number>;
  completeRun(runId: string, summary: Omit<ScoutRunSummary, "runId" | "failures">, partialReason?: string): Promise<void>;
  failRun(runId: string, reason: string): Promise<void>;
  /** Marca como expiradas as licitações cujo prazo venceu sem triagem. */
  expireOverdue(reference: Date): Promise<number>;
}

export interface TenderSource {
  fetchOpenTenders(): Promise<{ tenders: readonly PncpTender[]; failures: readonly string[] }>;
}

/**
 * Executa a varredura semanal: consulta a fonte pública, aplica o Estágio 1 do
 * funil e guarda na fila apenas o que é novo e se enquadra no perfil da empresa.
 *
 * O serviço nunca decide participar de nada — apenas afunila e organiza. A
 * decisão é sempre da equipe, na triagem.
 */
export class ScoutService {
  constructor(
    private readonly repository: ScoutRepository,
    private readonly source: TenderSource,
  ) {}

  async run(trigger: ScoutRunTrigger, reference: Date = new Date()): Promise<ScoutRunSummary> {
    const filter = (await this.repository.loadFilter()) ?? defaultScoutFilter;
    const runId = await this.repository.startRun(trigger);

    try {
      const { tenders: fetched, failures } = await this.source.fetchOpenTenders();
      const qualified = fetched.flatMap<QualifiedTender>((tender) => {
        const result = qualify(tender as CandidateTender, filter, reference);
        return result.qualified ? [{ ...tender, workTypes: result.workTypes }] : [];
      });

      // Licitação já triada em varredura anterior não retorna à fila, tenha
      // sido aprovada ou descartada.
      const known = new Set(await this.repository.findKnownExternalIds(qualified.map((tender) => tender.externalId)));
      const fresh = qualified.filter((tender) => !known.has(tender.externalId));

      const totalNew = fresh.length > 0 ? await this.repository.saveScoutedTenders(runId, fresh) : 0;
      await this.repository.expireOverdue(reference);

      const summary = { totalFetched: fetched.length, totalQualified: qualified.length, totalNew };
      // Varredura parcial é registrada como tal: o portal oscila, e a equipe
      // precisa saber que aquele domingo não cobriu tudo.
      await this.repository.completeRun(runId, summary, failures.length > 0 ? `Não foi possível consultar: ${failures.join(", ")}` : undefined);
      return { runId, ...summary, failures };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.repository.failRun(runId, reason.slice(0, 1_000));
      throw error;
    }
  }
}
