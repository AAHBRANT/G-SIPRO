import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { InvalidDocumentUploadError, storeDocumentFile } from "./document-storage";

const previousRoot = process.env.GSIPRO_DOCUMENT_STORAGE_ROOT;
afterEach(() => {
  if (previousRoot === undefined) delete process.env.GSIPRO_DOCUMENT_STORAGE_ROOT;
  else process.env.GSIPRO_DOCUMENT_STORAGE_ROOT = previousRoot;
  delete process.env.GSIPRO_DOCUMENT_MAX_BYTES;
});

describe("document storage", () => {
  it("stores the original bytes by server-calculated SHA-256", async () => {
    const root = await mkdtemp(join(tmpdir(), "gsipro-docs-"));
    process.env.GSIPRO_DOCUMENT_STORAGE_ROOT = root;
    const stored = await storeDocumentFile(new File(["conteudo oficial"], "edital.pdf", { type: "application/pdf" }));
    expect(stored.fileHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.uri).toBe(`gsipro://documents/sha256/${stored.fileHash}`);
    expect(await readFile(join(root, stored.fileHash.slice(0, 2), stored.fileHash.slice(2, 4), stored.fileHash), "utf8")).toBe("conteudo oficial");
  });

  it("rejects empty and oversized files", async () => {
    await expect(storeDocumentFile(new File([], "vazio.pdf"))).rejects.toBeInstanceOf(InvalidDocumentUploadError);
    process.env.GSIPRO_DOCUMENT_MAX_BYTES = "3";
    await expect(storeDocumentFile(new File(["1234"], "grande.pdf"))).rejects.toBeInstanceOf(InvalidDocumentUploadError);
  });
});
