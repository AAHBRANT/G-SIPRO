import { describe, expect, it, vi } from "vitest";
import { ProfessionalService, type ProfessionalRepository } from "./professional-service";

describe("ProfessionalService", () => {
  it("valida o cadastro antes de persistir", async () => {
    const repository: ProfessionalRepository = { create: vi.fn().mockResolvedValue({ id: "p1", fullName: "Profissional Sintético", council: "CREA-SP", registrationNumber: "000000", status: "ACTIVE", version: 1, links: 1 }), list: vi.fn().mockResolvedValue([]) };
    const result = await new ProfessionalService(repository).create({ fullName: "Profissional Sintético", council: "CREA-SP", registrationNumber: "000000", professionalTitle: "Engenheiro Civil", processingPurpose: "Comprovar capacidade técnico-profissional.", legalBasis: "Execução de contrato", links: [{ targetType: "CONTRACT", targetId: "11111111-1111-4111-8111-111111111111", role: "Responsável técnico", responsibility: "Responsabilidade registrada", startedAt: "2024-01-01", endedAt: "2024-12-31", source: "Contrato sintético", evidenceDocumentVersionId: "22222222-2222-4222-8222-222222222222" }] }, "33333333-3333-4333-8333-333333333333");
    expect(result.links).toBe(1);
    expect(repository.create).toHaveBeenCalledOnce();
  });
});
