import { createHash } from "node:crypto";
import { mkdir, open, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024;

export class InvalidDocumentUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDocumentUploadError";
  }
}

export type StoredDocumentFile = Readonly<{
  fileName: string;
  fileHash: string;
  mimeType: string;
  sizeBytes: bigint;
  uri: string;
}>;

function storageRoot(): string {
  return process.env.GSIPRO_DOCUMENT_STORAGE_ROOT?.trim() || join(/*turbopackIgnore: true*/ process.cwd(), ".data", "documents");
}

function maxFileSize(): number {
  const configured = Number(process.env.GSIPRO_DOCUMENT_MAX_BYTES);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : DEFAULT_MAX_FILE_SIZE;
}

export async function storeDocumentFile(file: File): Promise<StoredDocumentFile> {
  if (!file.name.trim() || file.size <= 0) throw new InvalidDocumentUploadError("Selecione um arquivo não vazio.");
  if (file.size > maxFileSize()) throw new InvalidDocumentUploadError("O arquivo excede o limite permitido para upload.");

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(bytes).digest("hex");
  const directory = join(/*turbopackIgnore: true*/ storageRoot(), fileHash.slice(0, 2), fileHash.slice(2, 4));
  const target = join(/*turbopackIgnore: true*/ directory, fileHash);
  await mkdir(directory, { recursive: true });

  try {
    const handle = await open(target, "wx");
    try { await handle.writeFile(bytes); } finally { await handle.close(); }
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    const existing = await stat(target);
    if (existing.size !== bytes.length) throw new Error("Conflito no armazenamento imutável do documento.");
  }

  return {
    fileName: file.name.trim().slice(0, 255),
    fileHash,
    mimeType: file.type.trim().slice(0, 160) || "application/octet-stream",
    sizeBytes: BigInt(bytes.length),
    uri: `gsipro://documents/sha256/${fileHash}`,
  };
}

export async function readDocumentFile(fileHash: string): Promise<Buffer> {
  if (!/^[a-f0-9]{64}$/.test(fileHash)) throw new InvalidDocumentUploadError("Hash documental inválido.");
  const target = join(/*turbopackIgnore: true*/ storageRoot(), fileHash.slice(0, 2), fileHash.slice(2, 4), fileHash);
  const metadata = await stat(target);
  if (metadata.size <= 0 || metadata.size > maxFileSize()) throw new InvalidDocumentUploadError("Arquivo documental indisponível para processamento.");
  const bytes = await readFile(target);
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (actualHash !== fileHash) throw new InvalidDocumentUploadError("A integridade do arquivo documental não foi confirmada.");
  return bytes;
}
