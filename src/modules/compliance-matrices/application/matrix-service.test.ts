import { describe, expect, it, vi } from "vitest";
import { ComplianceMatrixService, type ComplianceMatrixRepository } from "./matrix-service";

describe("ComplianceMatrixService", () => {
  it("valida e encaminha a criação da matriz", async () => {
    const repository: ComplianceMatrixRepository = { create: vi.fn().mockResolvedValue({ id: "matrix" }), list: vi.fn() };
    await new ComplianceMatrixService(repository).create({ tenderVersionId: "00000000-0000-4000-8000-000000000001", analysisReference: "Análise técnica inicial" }, "actor", "00000000-0000-4000-8000-000000000002");
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ analysisReference: "Análise técnica inicial" }), "actor", "00000000-0000-4000-8000-000000000002");
  });
});

