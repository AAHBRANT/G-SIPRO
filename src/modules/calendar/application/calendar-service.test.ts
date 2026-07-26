import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CalendarEventNotFoundError,
  CalendarService,
  type CalendarEventRecord,
  type CalendarEventRepository,
} from "./calendar-service";

const actorId = "11111111-1111-4111-8111-111111111111";
const responsibleId = "22222222-2222-4222-8222-222222222222";
const record: CalendarEventRecord = Object.freeze({
  id: "33333333-3333-4333-8333-333333333333",
  title: "Reunião de alinhamento",
  startAt: new Date("2026-08-01T10:00:00Z"),
  allDay: false,
  responsibleId,
  status: "SCHEDULED",
  version: 1,
});

describe("CalendarService", () => {
  let repository: CalendarEventRepository;
  let service: CalendarService;

  beforeEach(() => {
    repository = {
      create: vi.fn(async (draft) => ({ ...draft, id: record.id, status: "SCHEDULED", version: 1 })),
      findById: vi.fn(async () => record),
      update: vi.fn(async (existing, draft) => ({ ...draft, id: existing.id, status: existing.status, version: existing.version + 1 })),
      cancel: vi.fn(async (existing) => ({ ...existing, status: "CANCELLED", version: existing.version + 1 })),
    };
    service = new CalendarService(repository);
  });

  it("cria sempre como agendado", async () => {
    const created = await service.create({ title: "Reunião", startAt: "2026-08-01T10:00:00Z", responsibleId }, actorId);
    expect(created.status).toBe("SCHEDULED");
    expect(repository.create).toHaveBeenCalledOnce();
  });

  it("atualiza preservando campos não informados", async () => {
    const updated = await service.update(record.id, { title: "Reunião remarcada" }, actorId);
    expect(updated).toMatchObject({ title: "Reunião remarcada", responsibleId, version: 2 });
  });

  it("cancela um compromisso agendado", async () => {
    const cancelled = await service.cancel(record.id, actorId);
    expect(cancelled).toMatchObject({ status: "CANCELLED", version: 2 });
  });

  it("impede cancelar duas vezes", async () => {
    const cancelledRecord: CalendarEventRecord = { ...record, status: "CANCELLED" };
    repository.findById = vi.fn(async () => cancelledRecord);
    await expect(service.cancel(record.id, actorId)).rejects.toThrow();
  });

  it("falha explicitamente quando o registro não existe", async () => {
    repository.findById = vi.fn(async () => null);
    await expect(service.cancel(record.id, actorId)).rejects.toBeInstanceOf(CalendarEventNotFoundError);
  });
});
