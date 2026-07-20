import { describe, expect, it, vi } from "vitest";
import { ProposalService, type ProposalRepository } from "./proposal-service";

describe("ProposalService", () => {
  it("encaminha criação validada com ator e correlação", async () => {
    const repository: ProposalRepository = { create: vi.fn().mockResolvedValue({ id: "proposal" }), createVersion: vi.fn(), list: vi.fn() };
    await new ProposalService(repository).create({ code: "PROP-001", opportunityId: "00000000-0000-4000-8000-000000000001" }, "actor", "00000000-0000-4000-8000-000000000002");
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ code: "PROP-001" }), "actor", "00000000-0000-4000-8000-000000000002");
  });
  it("encaminha nova versão validada sem aceitar número informado pelo usuário", async () => {
    const repository: ProposalRepository = { create: vi.fn(), createVersion: vi.fn().mockResolvedValue({ id: "proposal" }), list: vi.fn() };
    await new ProposalService(repository).createVersion("proposal", { reason: "Revisão técnica solicitada." }, "actor", "00000000-0000-4000-8000-000000000002");
    expect(repository.createVersion).toHaveBeenCalledWith("proposal", { reason: "Revisão técnica solicitada." }, "actor", "00000000-0000-4000-8000-000000000002");
  });
});
