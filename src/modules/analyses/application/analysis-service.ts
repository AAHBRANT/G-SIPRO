import { randomUUID } from "node:crypto";
import { analysisDecisionSchema, analysisReassignmentSchema, analysisSchema, type AnalysisDraft } from "@/modules/analyses/domain/analysis";

export type AnalysisRecord = Readonly<AnalysisDraft & { id: string; status: "PENDING" | "VALIDATED" | "REJECTED"; version: number }>;
export interface AnalysisRepository {
  create(draft: AnalysisDraft, actorId: string, correlationId: string): Promise<AnalysisRecord>;
  findById(id: string): Promise<AnalysisRecord | null>;
  decide(record: AnalysisRecord, decision: "VALIDATED" | "REJECTED", justification: string, actorId: string, correlationId: string): Promise<AnalysisRecord>;
  reassign(record: AnalysisRecord, assigneeId: string, reason: string, actorId: string, correlationId: string): Promise<AnalysisRecord>;
}
export class AnalysisNotFoundError extends Error { constructor(id: string) { super(`Análise não encontrada: ${id}`); this.name = "AnalysisNotFoundError"; } }
export class AnalysisRuleError extends Error { constructor(message: string) { super(message); this.name = "AnalysisRuleError"; } }

export class AnalysisService {
  constructor(private readonly repository: AnalysisRepository) {}
  async create(input: unknown, actorId: string, correlationId: string = randomUUID()) {
    return this.repository.create(analysisSchema.parse(input), actorId, correlationId);
  }
  async decide(id: string, input: unknown, actorId: string, correlationId: string = randomUUID()) {
    const record = await this.requirePending(id);
    const decision = analysisDecisionSchema.parse(input);
    return this.repository.decide(record, decision.decision, decision.justification, actorId, correlationId);
  }
  async reassign(id: string, input: unknown, actorId: string, correlationId: string = randomUUID()) {
    const record = await this.requirePending(id);
    const reassignment = analysisReassignmentSchema.parse(input);
    if (record.assigneeId === reassignment.assigneeId) throw new AnalysisRuleError("A análise já está atribuída a esse responsável.");
    return this.repository.reassign(record, reassignment.assigneeId, reassignment.reason, actorId, correlationId);
  }
  private async requirePending(id: string) {
    const record = await this.repository.findById(id);
    if (!record) throw new AnalysisNotFoundError(id);
    if (record.status !== "PENDING") throw new AnalysisRuleError("Somente análise pendente pode ser alterada ou decidida.");
    return record;
  }
}
