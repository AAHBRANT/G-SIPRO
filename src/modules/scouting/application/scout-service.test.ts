import { describe, expect, it, vi } from "vitest";

import { ScoutService, type ScoutRepository, type TenderSource } from "@/modules/scouting/application/scout-service";
import { defaultScoutFilter, scoutFilterSchema, type ScoutFilter } from "@/modules/scouting/domain/scout-filter";
import type { PncpTender } from "@/modules/scouting/infrastructure/pncp-client";

const reference = new Date("2026-07-28T12:00:00.000Z");

function buildTender(overrides: Partial<PncpTender> = {}): PncpTender {
  return {
    externalId: "PNCP-1",
    subject: "Execução de obra de pavimentação da rodovia CE-363",
    authorityName: "Estado do Ceará",
    sphere: "E",
    state: "CE",
    estimatedValue: 5_000_000,
    valueUndisclosed: false,
    proposalClosesAt: new Date("2026-08-28T12:00:00.000Z"),
    modality: "Concorrência - Eletrônica",
    ...overrides,
  };
}

function buildRepository(overrides: Partial<ScoutRepository> = {}) {
  const saved: PncpTender[] = [];
  const repository: ScoutRepository = {
    loadFilter: vi.fn(async (): Promise<ScoutFilter | null> => null),
    startRun: vi.fn(async () => "run-1"),
    findKnownExternalIds: vi.fn(async () => []),
    saveScoutedTenders: vi.fn(async (_runId: string, tenders: readonly PncpTender[]) => { saved.push(...tenders); return tenders.length; }),
    completeRun: vi.fn(async () => {}),
    failRun: vi.fn(async () => {}),
    expireOverdue: vi.fn(async () => 0),
    ...overrides,
  };
  return { repository, saved };
}

function buildSource(tenders: readonly PncpTender[]): TenderSource {
  return { fetchOpenTenders: vi.fn(async () => ({ tenders, failures: [] })) };
}

describe("ScoutService", () => {
  it("guarda na fila somente o que se enquadra no perfil", async () => {
    const dentro = buildTender();
    const fora = buildTender({ externalId: "PNCP-2", subject: "Aquisição de gêneros alimentícios para merenda" });
    const { repository, saved } = buildRepository();

    const summary = await new ScoutService(repository, buildSource([dentro, fora])).run("SCHEDULED", reference);

    expect(summary).toMatchObject({ runId: "run-1", totalFetched: 2, totalQualified: 1, totalNew: 1 });
    expect(saved.map((tender) => tender.externalId)).toEqual(["PNCP-1"]);
  });

  it("não devolve à fila licitação já triada em varredura anterior", async () => {
    const { repository, saved } = buildRepository({ findKnownExternalIds: vi.fn(async () => ["PNCP-1"]) });

    const summary = await new ScoutService(repository, buildSource([buildTender()])).run("SCHEDULED", reference);

    expect(summary.totalQualified).toBe(1);
    expect(summary.totalNew).toBe(0);
    expect(saved).toHaveLength(0);
    expect(repository.saveScoutedTenders).not.toHaveBeenCalled();
  });

  it("usa a configuração padrão quando a equipe ainda não salvou filtros", async () => {
    const { repository } = buildRepository();
    await new ScoutService(repository, buildSource([buildTender()])).run("SCHEDULED", reference);
    expect(repository.loadFilter).toHaveBeenCalled();
  });

  it("respeita os filtros configurados pela equipe", async () => {
    const filter = scoutFilterSchema.parse({ ...defaultScoutFilter, states: ["RS"] });
    const { repository, saved } = buildRepository({ loadFilter: vi.fn(async () => filter) });

    const summary = await new ScoutService(repository, buildSource([buildTender({ state: "CE" })])).run("SCHEDULED", reference);

    expect(summary.totalQualified).toBe(0);
    expect(saved).toHaveLength(0);
  });

  it("expira as licitações vencidas sem triagem a cada varredura", async () => {
    const { repository } = buildRepository();
    await new ScoutService(repository, buildSource([])).run("SCHEDULED", reference);
    expect(repository.expireOverdue).toHaveBeenCalledWith(reference);
  });

  it("registra a falha da varredura e propaga o erro", async () => {
    const { repository } = buildRepository();
    const source: TenderSource = { fetchOpenTenders: vi.fn(async () => { throw new Error("portal indisponível"); }) };

    await expect(new ScoutService(repository, source).run("SCHEDULED", reference)).rejects.toThrow("portal indisponível");

    expect(repository.failRun).toHaveBeenCalledWith("run-1", "portal indisponível");
    expect(repository.completeRun).not.toHaveBeenCalled();
  });

  it("distingue a varredura manual da agendada", async () => {
    const { repository } = buildRepository();
    await new ScoutService(repository, buildSource([])).run("MANUAL", reference);
    expect(repository.startRun).toHaveBeenCalledWith("MANUAL");
  });
});
