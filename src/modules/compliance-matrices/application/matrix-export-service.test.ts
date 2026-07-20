import { describe, expect, it, vi } from "vitest";
import { MatrixExportService, type MatrixExportRepository } from "./matrix-export-service";

describe("MatrixExportService", () => {
  it("encaminha consolidação com ator e correlação", async () => {
    const repository: MatrixExportRepository = { finalize: vi.fn().mockResolvedValue({ id: "export" }), download: vi.fn() };
    await new MatrixExportService(repository).finalize("matrix", "actor", "00000000-0000-4000-8000-000000000001");
    expect(repository.finalize).toHaveBeenCalledWith("matrix", "actor", "00000000-0000-4000-8000-000000000001");
  });
});

