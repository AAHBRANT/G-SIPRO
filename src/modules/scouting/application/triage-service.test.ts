import { describe, expect, it, vi } from "vitest";

import {
  ScoutedTenderAlreadyDecidedError,
  ScoutedTenderNotFoundError,
  TriageService,
  type OpportunityCreationPort,
  type OpportunitySeed,
  type ScoutedTenderRecord,
  type TriageRepository,
} from "@/modules/scouting/application/triage-service";

const decidedAt = new Date("2026-07-29T13:00:00.000Z");

function buildRecord(overrides: Partial<ScoutedTenderRecord> = {}): ScoutedTenderRecord {
  return {
    id: "scouted-1",
    externalId: "PNCP-1",
    subject: "Construção de escola de educação infantil",
    authorityName: "Prefeitura de Gravataí",
    authorityDocument: "88000000000100",
    city: "Gravataí",
    state: "RS",
    estimatedValue: 8_450_000,
    valueUndisclosed: false,
    proposalClosesAt: new Date("2026-08-12T13:00:00.000Z"),
    status: "PENDING",
    ...overrides,
  };
}

function buildDependencies(record: ScoutedTenderRecord | null) {
  const seeds: OpportunitySeed[] = [];
  const repository: TriageRepository = {
    findById: vi.fn(async () => record),
    markApproved: vi.fn(async () => {}),
    markDiscarded: vi.fn(async () => {}),
    countPending: vi.fn(async () => 7),
  };
  const opportunities: OpportunityCreationPort = {
    createFromScoutedTender: vi.fn(async (seed: OpportunitySeed) => { seeds.push(seed); return "opportunity-1"; }),
  };
  return { repository, opportunities, seeds };
}

describe("TriageService.approve", () => {
  it("cria a oportunidade com os dados da licitação e vincula à fila", async () => {
    const { repository, opportunities, seeds } = buildDependencies(buildRecord());

    const opportunityId = await new TriageService(repository, opportunities).approve("scouted-1", "user-1", "corr-1", decidedAt);

    expect(opportunityId).toBe("opportunity-1");
    expect(seeds[0]).toMatchObject({
      subject: "Construção de escola de educação infantil",
      authorityName: "Prefeitura de Gravataí",
      estimatedValue: 8_450_000,
      deliveryAt: new Date("2026-08-12T13:00:00.000Z"),
    });
    expect(repository.markApproved).toHaveBeenCalledWith("scouted-1", "opportunity-1", "user-1", decidedAt);
  });

  it("define como responsável quem aprovou, e não o sistema", async () => {
    const { repository, opportunities, seeds } = buildDependencies(buildRecord());
    await new TriageService(repository, opportunities).approve("scouted-1", "user-42", "corr-1", decidedAt);
    expect(seeds[0]?.ownerId).toBe("user-42");
  });

  it("recusa aprovar licitação inexistente", async () => {
    const { repository, opportunities } = buildDependencies(null);
    await expect(new TriageService(repository, opportunities).approve("sumida", "user-1", "corr-1")).rejects.toBeInstanceOf(ScoutedTenderNotFoundError);
  });

  it("recusa aprovar licitação já triada", async () => {
    const { repository, opportunities } = buildDependencies(buildRecord({ status: "DISCARDED" }));
    await expect(new TriageService(repository, opportunities).approve("scouted-1", "user-1", "corr-1")).rejects.toBeInstanceOf(ScoutedTenderAlreadyDecidedError);
  });

  it("não cria oportunidade quando a licitação já foi triada", async () => {
    const { repository, opportunities } = buildDependencies(buildRecord({ status: "APPROVED" }));
    await expect(new TriageService(repository, opportunities).approve("scouted-1", "user-1", "corr-1")).rejects.toThrow();
    expect(opportunities.createFromScoutedTender).not.toHaveBeenCalled();
  });
});

describe("TriageService.discard", () => {
  it("registra o descarte com autor e motivo", async () => {
    const { repository, opportunities } = buildDependencies(buildRecord());

    await new TriageService(repository, opportunities).discard("scouted-1", "user-1", "Fora da região de atuação", decidedAt);

    expect(repository.markDiscarded).toHaveBeenCalledWith("scouted-1", "user-1", "Fora da região de atuação", decidedAt);
  });

  it("exige motivo no descarte", async () => {
    const { repository, opportunities } = buildDependencies(buildRecord());
    await expect(new TriageService(repository, opportunities).discard("scouted-1", "user-1", "  ")).rejects.toThrow();
  });

  it("não cria oportunidade ao descartar", async () => {
    const { repository, opportunities } = buildDependencies(buildRecord());
    await new TriageService(repository, opportunities).discard("scouted-1", "user-1", "Sem acervo compatível", decidedAt);
    expect(opportunities.createFromScoutedTender).not.toHaveBeenCalled();
  });
});

describe("TriageService.pendingCount", () => {
  it("informa a quantidade que alimenta o aviso da barra lateral", async () => {
    const { repository, opportunities } = buildDependencies(buildRecord());
    await expect(new TriageService(repository, opportunities).pendingCount()).resolves.toBe(7);
  });
});
