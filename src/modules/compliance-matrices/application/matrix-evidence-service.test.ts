import { describe, expect, it, vi } from "vitest";
import { MatrixEvidenceService, type MatrixEvidenceRepository } from "./matrix-evidence-service";

describe("MatrixEvidenceService", () => {
  it("encaminha associação validada com correlação", async () => {
    const repository: MatrixEvidenceRepository = { associate: vi.fn().mockResolvedValue({ id: "association" }) };
    await new MatrixEvidenceService(repository).associate("item", { technicalEvidenceId: "00000000-0000-4000-8000-000000000001", locator: "Página 2", justification: "Atesta diretamente o requisito." }, "actor", "00000000-0000-4000-8000-000000000002");
    expect(repository.associate).toHaveBeenCalledWith("item", expect.objectContaining({ locator: "Página 2", comparisons: [] }), "actor", "00000000-0000-4000-8000-000000000002");
  });
});

