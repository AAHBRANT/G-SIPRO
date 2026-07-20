import { describe, expect, it, vi } from "vitest";

import { TenderService, type TenderRepository } from "./tender-service";

const actor = "11111111-1111-4111-8111-111111111111";
const hash = "a".repeat(64);

describe("TenderService", () => {
  it("cria edital e versão inicial validados", async () => {
    const repository: TenderRepository = {
      create: vi.fn(async (tender) => ({ id: actor, code: tender.code, number: tender.number, version: 1 })),
      addVersion: vi.fn(),
    };
    const service = new TenderService(repository);
    const result = await service.create({
      tender: { code: "ED-1", number: "1/2026", modality: "Pregão", subject: "Objeto", origin: "Portal" },
      version: { fileName: "edital.pdf", fileHash: hash, uri: `gsipro://documents/sha256/${hash}`, mimeType: "application/pdf", sizeBytes: 10, source: "Portal", receivedAt: new Date() },
    }, actor);
    expect(result.version).toBe(1);
  });

  it("rejeita versão sem hash SHA-256", async () => {
    const repository = { create: vi.fn(), addVersion: vi.fn() } as TenderRepository;
    await expect(new TenderService(repository).addVersion(actor, { fileName: "x.pdf", fileHash: "abc", uri: "gsipro://documents/sha256/abc", mimeType: "application/pdf", sizeBytes: 10, source: "Portal", receivedAt: new Date() }, actor)).rejects.toThrow();
  });
});
