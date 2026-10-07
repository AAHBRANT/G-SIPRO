import { describe, expect, it, vi } from "vitest";

import {
  ScoutedTenderAlreadyDecidedError,
  ScoutedTenderNotFoundError,
  TriageService,
  type OpportunityCreationPort,
  type OpportunitySeed,
  type ScoutedTenderRecord,
  type TriageRepository,
  type TwinTenders,
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

/**
 * O dublê imita o banco: a trava só passa enquanto a licitação está pendente,
 * e a leitura (`findById`) devolve sempre a foto inicial — como acontece
 * quando dois cliques leem antes de qualquer um gravar.
 */
function buildDependencies(record: ScoutedTenderRecord | null, twins: TwinTenders = { pending: [], approved: [] }) {
  const seeds: OpportunitySeed[] = [];
  let status = record?.status;
  const repository: TriageRepository = {
    findById: vi.fn(async () => record),
    claimForApproval: vi.fn(async () => {
      if (status !== "PENDING") return false;
      status = "APPROVED";
      return true;
    }),
    linkOpportunity: vi.fn(async () => {}),
    releaseApproval: vi.fn(async () => { status = "PENDING"; }),
    markDiscarded: vi.fn(async (id: string) => {
      if (id !== record?.id) return true;
      if (status !== "PENDING") return false;
      status = "DISCARDED";
      return true;
    }),
    findTwins: vi.fn(async () => twins),
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

    const { opportunityId, reaproveitada } = await new TriageService(repository, opportunities).approve("scouted-1", "user-1", "corr-1", decidedAt);

    expect(opportunityId).toBe("opportunity-1");
    expect(reaproveitada).toBe(false);
    expect(seeds[0]).toMatchObject({
      subject: "Construção de escola de educação infantil",
      authorityName: "Prefeitura de Gravataí",
      estimatedValue: 8_450_000,
      deliveryAt: new Date("2026-08-12T13:00:00.000Z"),
    });
    expect(repository.claimForApproval).toHaveBeenCalledWith("scouted-1", "user-1", decidedAt);
    expect(repository.linkOpportunity).toHaveBeenCalledWith("scouted-1", "opportunity-1");
  });

  it("trava a licitação como aprovada antes de criar a oportunidade", async () => {
    const { repository, opportunities } = buildDependencies(buildRecord());
    await new TriageService(repository, opportunities).approve("scouted-1", "user-1", "corr-1", decidedAt);
    const claimOrder = vi.mocked(repository.claimForApproval).mock.invocationCallOrder[0]!;
    const createOrder = vi.mocked(opportunities.createFromScoutedTender).mock.invocationCallOrder[0]!;
    expect(claimOrder).toBeLessThan(createOrder);
  });

  /**
   * Bug de 05/10/2026: aprovada, a licitação continuava na fila e dava para
   * aprovar ou descartar de novo, sem fim. A segunda tentativa tem de ser
   * recusada e não pode criar outra oportunidade.
   */
  it("segunda aprovação da mesma licitação é recusada e não duplica a oportunidade", async () => {
    const { repository, opportunities } = buildDependencies(buildRecord());
    const service = new TriageService(repository, opportunities);

    await service.approve("scouted-1", "user-1", "corr-1", decidedAt);
    await expect(service.approve("scouted-1", "user-2", "corr-2", decidedAt)).rejects.toBeInstanceOf(ScoutedTenderAlreadyDecidedError);

    expect(opportunities.createFromScoutedTender).toHaveBeenCalledTimes(1);
  });

  it("descartar depois de aprovar é recusado", async () => {
    const { repository, opportunities } = buildDependencies(buildRecord());
    const service = new TriageService(repository, opportunities);

    await service.approve("scouted-1", "user-1", "corr-1", decidedAt);
    await expect(service.discard("scouted-1", "user-1", "Mudei de ideia", decidedAt)).rejects.toBeInstanceOf(ScoutedTenderAlreadyDecidedError);
  });

  it("devolve a licitação à fila quando a oportunidade não chega a ser criada", async () => {
    const { repository, opportunities } = buildDependencies(buildRecord());
    vi.mocked(opportunities.createFromScoutedTender).mockRejectedValueOnce(new Error("banco fora"));
    const service = new TriageService(repository, opportunities);

    await expect(service.approve("scouted-1", "user-1", "corr-1", decidedAt)).rejects.toThrow("banco fora");
    expect(repository.releaseApproval).toHaveBeenCalledWith("scouted-1");
    expect(repository.linkOpportunity).not.toHaveBeenCalled();
    // Liberada, pode ser aprovada de novo.
    await expect(service.approve("scouted-1", "user-1", "corr-2", decidedAt)).resolves.toMatchObject({ opportunityId: "opportunity-1" });
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

/**
 * "o sistema nao esta lendo e preenchendo a licitação depois de aprovada é
 * como se o ususario tivesse que fazer o cadastro todo de novo" — o que o
 * portal já entregou não pode voltar a ser digitado. O seed é o contrato
 * dessa promessa: o que não passar por aqui some na aprovação.
 */
describe("o que a aprovação leva para a oportunidade", () => {
  it("carrega esfera, município e data de abertura, além do que já levava", async () => {
    const record = buildRecord({
      sphere: "M",
      city: "Vitória",
      state: "ES",
      proposalOpensAt: new Date("2026-08-01T13:00:00.000Z"),
    });
    const { repository, opportunities, seeds } = buildDependencies(record);

    await new TriageService(repository, opportunities).approve(record.id, "ator-1", "corr-1", decidedAt);

    expect(seeds[0]).toMatchObject({
      subject: record.subject,
      authorityName: record.authorityName,
      authorityDocument: record.authorityDocument,
      sphere: "M",
      city: "Vitória",
      state: "ES",
      publishedAt: new Date("2026-08-01T13:00:00.000Z"),
      deliveryAt: record.proposalClosesAt,
      ownerId: "ator-1",
    });
  });

  /** Licitação sem data de abertura não pode inventar uma. */
  it("não inventa data de abertura quando o órgão não informou", async () => {
    const { repository, opportunities, seeds } = buildDependencies(buildRecord());
    await new TriageService(repository, opportunities).approve("scouted-1", "ator-1", "corr-1", decidedAt);
    expect(seeds[0]?.publishedAt).toBeUndefined();
  });
});

/**
 * Relato de 07/10/2026: "ainda tá" — a mesma obra publicada duas vezes no
 * PNCP. Aprovada uma publicação, a outra continuava na fila sem aviso e
 * aprová-la criava a segunda oportunidade da mesma obra.
 */
describe("a mesma obra publicada mais de uma vez", () => {
  it("não cria oportunidade nova quando outra publicação da obra já foi aprovada", async () => {
    const { repository, opportunities } = buildDependencies(buildRecord(), {
      pending: [],
      approved: [{ id: "scouted-0", opportunityId: "opportunity-0" }],
    });

    const resultado = await new TriageService(repository, opportunities).approve("scouted-1", "user-1", "corr-1", decidedAt);

    expect(resultado).toEqual({ opportunityId: "opportunity-0", reaproveitada: true });
    expect(opportunities.createFromScoutedTender).not.toHaveBeenCalled();
    expect(repository.claimForApproval).not.toHaveBeenCalled();
    expect(repository.markDiscarded).toHaveBeenCalledWith("scouted-1", "user-1", expect.stringContaining("scouted-0"), decidedAt);
  });

  it("ao aprovar, tira da fila as outras publicações pendentes da mesma obra", async () => {
    const { repository, opportunities } = buildDependencies(buildRecord(), { pending: ["scouted-2", "scouted-3"], approved: [] });

    await new TriageService(repository, opportunities).approve("scouted-1", "user-1", "corr-1", decidedAt);

    expect(opportunities.createFromScoutedTender).toHaveBeenCalledTimes(1);
    expect(repository.markDiscarded).toHaveBeenCalledWith("scouted-2", undefined, expect.stringContaining("scouted-1"), decidedAt);
    expect(repository.markDiscarded).toHaveBeenCalledWith("scouted-3", undefined, expect.stringContaining("scouted-1"), decidedAt);
  });
});
