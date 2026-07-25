import { describe, expect, it, vi } from "vitest";
import {
  ProposalTenderLinkService,
  type ProposalTenderLinkRepository,
} from "./proposal-tender-link-service";

const proposalId = "00000000-0000-4000-8000-000000000001";
const documentVersionId = "00000000-0000-4000-8000-000000000002";

describe("ProposalTenderLinkService", () => {
  it("encaminha identificadores validados ao repositório idempotente", async () => {
    const repository: ProposalTenderLinkRepository = {
      promote: vi.fn().mockResolvedValue({
        tenderId: "tender",
        tenderVersionId: "version",
        tenderLotId: "lot",
        code: "EDT-PROP-001",
        reused: false,
      }),
    };
    const result = await new ProposalTenderLinkService(repository).promote(
      proposalId,
      { documentVersionId },
      "actor",
      "00000000-0000-4000-8000-000000000003",
    );
    expect(result.code).toBe("EDT-PROP-001");
    expect(repository.promote).toHaveBeenCalledWith(
      proposalId,
      documentVersionId,
      "actor",
      "00000000-0000-4000-8000-000000000003",
    );
  });

  it("rejeita versão documental inválida", () => {
    const repository: ProposalTenderLinkRepository = { promote: vi.fn() };
    expect(() =>
      new ProposalTenderLinkService(repository).promote(
        proposalId,
        { documentVersionId: "inválido" },
        "actor",
      ),
    ).toThrow();
  });
});
