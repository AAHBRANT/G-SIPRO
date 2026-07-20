import { describe, expect, it } from "vitest";

import { tenderSchema, tenderVersionSchema } from "./tender";

describe("regras de cadastro e versão de edital", () => {
  it("exige origem e dados mínimos do edital", () => {
    expect(() => tenderSchema.parse({ code: "ED-1", number: "1", modality: "Pregão", subject: "Objeto" })).toThrow();
  });

  it("aceita edital com lotes controlados", () => {
    expect(tenderSchema.parse({ code: "ED-1", number: "1", modality: "Pregão", subject: "Objeto", origin: "Portal oficial", lots: [{ code: "L1", subject: "Lote 1" }] }).lots).toHaveLength(1);
  });

  it("exige hash SHA-256 na versão e nos anexos", () => {
    expect(() => tenderVersionSchema.parse({ fileName: "edital.pdf", fileHash: "abc", uri: "gsipro://documents/sha256/abc", mimeType: "application/pdf", sizeBytes: 10, source: "Portal", receivedAt: new Date() })).toThrow();
    expect(tenderVersionSchema.parse({ fileName: "edital.pdf", fileHash: "a".repeat(64), uri: `gsipro://documents/sha256/${"a".repeat(64)}`, mimeType: "application/pdf", sizeBytes: 10, source: "Portal", receivedAt: new Date() }).fileHash).toHaveLength(64);
  });
});
