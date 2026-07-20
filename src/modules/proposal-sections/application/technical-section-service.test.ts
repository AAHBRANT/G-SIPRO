import { describe, expect, it, vi } from "vitest";
import { TechnicalSectionService, type TechnicalSectionRepository } from "./technical-section-service";
const id = "00000000-0000-4000-8000-000000000001";
describe("TechnicalSectionService", () => {
  it("encaminha criação validada com ator e correlação", async () => { const repository: TechnicalSectionRepository = { create: vi.fn().mockResolvedValue({ id }), update: vi.fn() }; await new TechnicalSectionService(repository).create(id, { type: "Equipe", title: "Equipe técnica", position: 1, responsibleId: id }, id, id); expect(repository.create).toHaveBeenCalledWith(id, expect.objectContaining({ title: "Equipe técnica" }), id, id); });
  it("encaminha atualização com controle de versão", async () => { const repository: TechnicalSectionRepository = { create: vi.fn(), update: vi.fn().mockResolvedValue({ id }) }; await new TechnicalSectionService(repository).update(id, id, { responsibleId: id, status: "IN_REVIEW", version: 2 }, id, id); expect(repository.update).toHaveBeenCalledWith(id, id, expect.objectContaining({ version: 2 }), id, id); });
});
