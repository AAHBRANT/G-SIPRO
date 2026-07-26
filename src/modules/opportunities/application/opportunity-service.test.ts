import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  OpportunityNotFoundError,
  OpportunityService,
  type OpportunityRecord,
  type OpportunityRepository,
} from "./opportunity-service";

const actorId = "11111111-1111-4111-8111-111111111111";
const record: OpportunityRecord = Object.freeze({
  id: "22222222-2222-4222-8222-222222222222",
  code: "OP-0001",
  origin: "PORTAL",
  subject: "Aquisição de solução",
  ownerId: actorId,
  customerId: "44444444-4444-4444-8444-444444444444",
  estimatedValue: 50_000,
  currency: "BRL",
  valueSource: "Estimativa interna",
  deliveryAt: new Date("2026-12-01T00:00:00.000Z"),
  datesSource: "Edital de referência",
  datesTimeZone: "America/Sao_Paulo",
  status: "QUALIFICATION",
  version: 1,
});

describe("OpportunityService", () => {
  let repository: OpportunityRepository;
  let service: OpportunityService;

  beforeEach(() => {
    repository = {
      create: vi.fn(async (draft) => ({ ...draft, id: record.id, code: "PPB-010-26", status: "DRAFT", version: 1 })),
      findById: vi.fn(async () => record),
      revise: vi.fn(async ({ after }) => after),
    };
    service = new OpportunityService(repository);
  });

  it("cria sempre em rascunho, sem aceitar código informado pelo chamador", async () => {
    const created = await service.create({ origin: "CHANNEL" }, actorId);
    expect(created.status).toBe("DRAFT");
    expect(created.code).toBe("PPB-010-26");
    expect(repository.create).toHaveBeenCalledOnce();
    expect(repository.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: expect.anything() }),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it("ativa quando os dados mínimos existem", async () => {
    const activated = await service.transition(record.id, "ACTIVE", actorId);
    expect(activated).toMatchObject({ status: "ACTIVE", version: 2 });
  });

  it("valida e delega a oportunidade na mesma transação lógica", async () => {
    const responsibleId = "33333333-3333-4333-8333-333333333333";
    const activated = await service.transition(record.id, "ACTIVE", actorId, { ownerId: responsibleId });
    expect(activated).toMatchObject({ status: "ACTIVE", ownerId: responsibleId, version: 2 });
    expect(repository.revise).toHaveBeenCalledWith(expect.objectContaining({
      after: expect.objectContaining({ ownerId: responsibleId }),
    }));
  });

  it("registra motivo na reabertura controlada", async () => {
    const closed: OpportunityRecord = { ...record, status: "CLOSED" };
    repository.findById = vi.fn(async () => closed);
    await service.transition(record.id, "QUALIFICATION", actorId, { reason: "Nova evidência" });
    expect(repository.revise).toHaveBeenCalledWith(expect.objectContaining({ reason: "Nova evidência" }));
  });

  it("falha explicitamente quando o registro não existe", async () => {
    repository.findById = vi.fn(async () => null);
    await expect(service.transition(record.id, "ACTIVE", actorId)).rejects.toBeInstanceOf(OpportunityNotFoundError);
  });
});
