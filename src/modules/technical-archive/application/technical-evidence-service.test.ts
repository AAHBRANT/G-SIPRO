import { describe, expect, it, vi } from "vitest";
import { TechnicalEvidenceService, type TechnicalEvidenceRepository } from "./technical-evidence-service";

describe("TechnicalEvidenceService", () => {
  it("valida e encaminha uma nova versão documental", async () => {
    const repository: TechnicalEvidenceRepository = { create: vi.fn().mockResolvedValue({ id: "e1", type: "ATTESTATION", number: "ATEST-001", version: 1, status: "CURRENT" }) };
    const result = await new TechnicalEvidenceService(repository).create({ experienceId: "11111111-1111-4111-8111-111111111111", type: "ATTESTATION", number: "ATEST-001", issuingBody: "Cliente emissor", issuedAt: "2025-01-10", subjectActivity: "Objeto comprovado", documentVersionId: "22222222-2222-4222-8222-222222222222" }, "33333333-3333-4333-8333-333333333333");
    expect(result.version).toBe(1);
    expect(repository.create).toHaveBeenCalledOnce();
  });
});
