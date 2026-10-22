import { describe, expect, it } from "vitest";

import { editalReadingFromRow, type EditalReadingRow } from "@/modules/scouting/infrastructure/prisma-edital-reading";

const linha = (overrides: Partial<EditalReadingRow> = {}): EditalReadingRow => ({
  tenderId: "t-1",
  executionId: null,
  readMethod: "PATTERN_MATCH",
  sourceUri: "https://pncp.gov.br/arquivos/1",
  sourceFilename: "edital.pdf",
  sourceFileHash: "a".repeat(64),
  sourceFetchedAt: new Date("2026-10-22T12:00:00Z"),
  services: [],
  consortiumAllowed: null,
  requiresCat: true,
  requiresSiteVisit: null,
  confidence: null,
  limitations: [],
  reviewedAt: null,
  ...overrides,
});

describe("editalReadingFromRow", () => {
  /** Até 22/10/2026 a garantia de proposta era lida e se perdia ao gravar. */
  it("traz de volta a garantia de proposta", () => {
    expect(editalReadingFromRow(linha({ requiresProposalBond: true })).requirement.requiresProposalBond).toBe(true);
    expect(editalReadingFromRow(linha({ requiresProposalBond: false })).requirement.requiresProposalBond).toBe(false);
    expect(editalReadingFromRow(linha({ requiresProposalBond: null })).requirement).not.toHaveProperty("requiresProposalBond");
  });

  it("traz a lista de documentos lidos e ignora item malformado", () => {
    const lida = editalReadingFromRow(linha({
      sourceDocuments: [
        { filename: "TR.docx", uri: "https://pncp.gov.br/arquivos/2" },
        { filename: 42 },
        null,
        { filename: "edital.pdf", uri: "https://pncp.gov.br/arquivos/1" },
      ],
    }));
    expect(lida.documentos).toEqual([
      { filename: "TR.docx", uri: "https://pncp.gov.br/arquivos/2" },
      { filename: "edital.pdf", uri: "https://pncp.gov.br/arquivos/1" },
    ]);
  });

  it("leitura anterior à leitura com anexos volta com a lista vazia", () => {
    expect(editalReadingFromRow(linha({ sourceDocuments: [] })).documentos).toEqual([]);
    expect(editalReadingFromRow(linha()).documentos).toEqual([]);
  });
});
