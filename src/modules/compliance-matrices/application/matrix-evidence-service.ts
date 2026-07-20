import { randomUUID } from "node:crypto";
import { matrixEvidenceSchema, type MatrixEvidenceDraft } from "@/modules/compliance-matrices/domain/matrix-evidence";

export type MatrixEvidenceRecord = Readonly<{ id: string; matrixItemId: string; technicalEvidenceId: string; evidenceFileHash: string; locator: string; comparisons: number }>;
export interface MatrixEvidenceRepository { associate(matrixItemId: string, draft: MatrixEvidenceDraft, actorId: string, correlationId: string): Promise<MatrixEvidenceRecord>; }

export class MatrixEvidenceService {
  constructor(private readonly repository: MatrixEvidenceRepository) {}
  associate(matrixItemId: string, input: unknown, actorId: string, correlationId: string = randomUUID()) { return this.repository.associate(matrixItemId, matrixEvidenceSchema.parse(input), actorId, correlationId); }
}

