import { describe, expect, it, vi } from "vitest";
import { ArchiveSearchService, type ArchiveSearchRepository } from "./archive-search-service";

describe("ArchiveSearchService", () => {
  it("valida e encaminha os filtros com correlação", async () => {
    const repository: ArchiveSearchRepository = { search: vi.fn().mockResolvedValue({ total: 0, page: 1, pageSize: 25, items: [] }) };
    await new ArchiveSearchService(repository).search({ characteristic: "concreto", page: "2", pageSize: "10" }, "actor", "00000000-0000-4000-8000-000000000001");
    expect(repository.search).toHaveBeenCalledWith(expect.objectContaining({ characteristic: "concreto", page: 2, pageSize: 10 }), "actor", "00000000-0000-4000-8000-000000000001");
  });
});

