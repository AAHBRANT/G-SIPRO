import { describe, expect, it } from "vitest";

import {
  assertCalendarEventCancellable,
  calendarEventSchema,
  CalendarEventRuleError,
} from "./calendar-event";

const responsibleId = "11111111-1111-4111-8111-111111111111";

describe("calendarEventSchema", () => {
  it("aceita um compromisso mínimo válido", () => {
    const result = calendarEventSchema.parse({ title: "Reunião", startAt: "2026-08-01T10:00:00Z", responsibleId });
    expect(result).toMatchObject({ title: "Reunião", allDay: false, category: "MEETING" });
  });

  it("aceita categorias válidas e rejeita categoria desconhecida", () => {
    const result = calendarEventSchema.parse({ title: "Viagem", startAt: "2026-08-01T10:00:00Z", responsibleId, category: "TRAVEL" });
    expect(result.category).toBe("TRAVEL");
    expect(() =>
      calendarEventSchema.parse({ title: "Reunião", startAt: "2026-08-01T10:00:00Z", responsibleId, category: "INVALIDA" }),
    ).toThrow();
  });

  it("rejeita término anterior ao início", () => {
    expect(() =>
      calendarEventSchema.parse({
        title: "Reunião",
        startAt: "2026-08-01T10:00:00Z",
        endAt: "2026-08-01T09:00:00Z",
        responsibleId,
      }),
    ).toThrow();
  });

  it("rejeita vínculo com mais de um registro ao mesmo tempo", () => {
    expect(() =>
      calendarEventSchema.parse({
        title: "Reunião",
        startAt: "2026-08-01T10:00:00Z",
        responsibleId,
        opportunityId: "22222222-2222-4222-8222-222222222222",
        tenderId: "33333333-3333-4333-8333-333333333333",
      }),
    ).toThrow();
  });
});

describe("fuso horário", () => {
  it("interpreta um horário sem fuso (do formulário) como horário de Brasília, não UTC", () => {
    const result = calendarEventSchema.parse({ title: "Reunião", startAt: "2026-08-01T14:00", responsibleId });
    expect(result.startAt.toISOString()).toBe("2026-08-01T17:00:00.000Z");
  });

  it("mantém um horário que já vem com fuso explícito sem alterar", () => {
    const result = calendarEventSchema.parse({ title: "Reunião", startAt: "2026-08-01T14:00:00-03:00", responsibleId });
    expect(result.startAt.toISOString()).toBe("2026-08-01T17:00:00.000Z");
  });

  it("também converte o término informado sem fuso", () => {
    const result = calendarEventSchema.parse({ title: "Reunião", startAt: "2026-08-01T14:00", endAt: "2026-08-01T15:30", responsibleId });
    expect(result.endAt?.toISOString()).toBe("2026-08-01T18:30:00.000Z");
  });
});

describe("participantIds", () => {
  it("aceita lista vazia por padrão quando não informado", () => {
    const result = calendarEventSchema.parse({ title: "Reunião", startAt: "2026-08-01T10:00:00Z", responsibleId });
    expect(result.participantIds).toEqual([]);
  });

  it("aceita múltiplos participantes válidos", () => {
    const participantIds = ["44444444-4444-4444-8444-444444444444", "55555555-5555-4555-8555-555555555555"];
    const result = calendarEventSchema.parse({ title: "Reunião", startAt: "2026-08-01T10:00:00Z", responsibleId, participantIds });
    expect(result.participantIds).toEqual(participantIds);
  });
});

describe("assertCalendarEventCancellable", () => {
  it("permite cancelar um compromisso agendado", () => {
    expect(() => assertCalendarEventCancellable("SCHEDULED")).not.toThrow();
  });

  it("impede cancelar um compromisso já cancelado", () => {
    expect(() => assertCalendarEventCancellable("CANCELLED")).toThrow(CalendarEventRuleError);
  });
});
