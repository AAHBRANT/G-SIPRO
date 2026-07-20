import { randomUUID } from "node:crypto";

export type MatrixExportRecord = Readonly<{ id: string; matrixId: string; matrixVersion: number; fileName: string; fileHash: string; exportedAt: Date }>;
export type MatrixExportDownload = MatrixExportRecord & Readonly<{ content: string }>;
export interface MatrixExportRepository { finalize(matrixId: string, actorId: string, correlationId: string): Promise<MatrixExportRecord>; download(exportId: string, actorId: string, correlationId: string): Promise<MatrixExportDownload>; }

export class MatrixExportService {
  constructor(private readonly repository: MatrixExportRepository) {}
  finalize(matrixId: string, actorId: string, correlationId: string = randomUUID()) { return this.repository.finalize(matrixId, actorId, correlationId); }
  download(exportId: string, actorId: string, correlationId: string = randomUUID()) { return this.repository.download(exportId, actorId, correlationId); }
}

