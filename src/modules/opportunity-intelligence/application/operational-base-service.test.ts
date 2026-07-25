import { describe, expect, it, vi } from "vitest";

import { OperationalBaseService, type OperationalBaseRepository } from "./operational-base-service";

describe("OperationalBaseService", () => {
  it("normalizes and delegates a valid base", async () => {
    const repository = { create: vi.fn(), listActive: vi.fn() } satisfies OperationalBaseRepository;
    await new OperationalBaseService(repository).create({
      code: "sede",
      name: "Sede",
      locality: "Belo Horizonte/MG",
      latitude: -19.92,
      longitude: -43.94,
      source: "Cadastro corporativo",
    }, "00000000-0000-4000-8000-000000000001");
    expect(repository.create.mock.calls[0]?.[0].code).toBe("SEDE");
  });
});
