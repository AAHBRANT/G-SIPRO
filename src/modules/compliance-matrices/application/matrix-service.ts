import { randomUUID } from "node:crypto";
import { complianceMatrixSchema, type ComplianceMatrixDraft } from "@/modules/compliance-matrices/domain/matrix";

export type ComplianceMatrixRecord = Readonly<{
  id: string;
  analysisReference: string;
  version: number;
  status: string;
  sourceFileHash: string;
  itemCount: number;
  tender: { id: string; code: string; number: string; subject: string; version: number; fileName: string };
  exports: ReadonlyArray<{ id: string; fileName: string; fileHash: string; exportedAt: Date }>;
  items: ReadonlyArray<{ id: string; requirementId: string; requirementVersion: number; requirementType: string; requirementText: string; criticality: string; sourceExcerpt: string; sourcePage: number; evidenceLinks: ReadonlyArray<{ id: string; technicalEvidenceId: string; evidenceLabel: string; evidenceStatus: string; documentLabel: string; evidenceFileHash: string; locator: string; justification: string; comparisons: ReadonlyArray<{ id: string; requiredValue: string; requiredUnit: string; provenValue: string; provenUnit: string; normalizedProvenValue: string; difference: string; conversionFactor: string | null; conversionRule: string | null; conversionSource: string | null; quantitySource: string }> }>; assessments: ReadonlyArray<{ id: string; version: number; decision: string; justification: string; gapDescription: string | null; riskDescription: string | null; impact: string | null; treatment: string | null; responsible: string | null; responsibleId: string | null; dueAt: Date | null; evidenceCount: number; validatedAt: Date; validatedBy: string }> }>;
}>;

export interface ComplianceMatrixRepository {
  create(draft: ComplianceMatrixDraft, actorId: string, correlationId: string): Promise<ComplianceMatrixRecord>;
  list(actorId: string, correlationId: string): Promise<ReadonlyArray<ComplianceMatrixRecord>>;
}

export class ComplianceMatrixService {
  constructor(private readonly repository: ComplianceMatrixRepository) {}
  create(input: unknown, actorId: string, correlationId: string = randomUUID()) { return this.repository.create(complianceMatrixSchema.parse(input), actorId, correlationId); }
  list(actorId: string, correlationId: string = randomUUID()) { return this.repository.list(actorId, correlationId); }
}
