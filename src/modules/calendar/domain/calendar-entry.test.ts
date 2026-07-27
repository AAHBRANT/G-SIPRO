import { describe, expect, it } from "vitest";

import { mergeCalendarEntries } from "./calendar-entry";

describe("mergeCalendarEntries", () => {
  it("combina as três fontes numa lista única, ordenada por data", () => {
    const entries = mergeCalendarEntries({
      deadlines: [{
        id: "deadline-1",
        event: "Entrega de propostas do edital",
        dueAt: new Date("2026-08-10T12:00:00Z"),
        responsibleId: "user-1",
        responsible: { displayName: "Ana" },
        tender: { id: "tender-1" },
      }],
      proposals: [{
        id: "proposal-1",
        code: "PPB-001-26",
        opportunity: {
          id: "opportunity-1",
          deliveryAt: new Date("2026-08-05T12:00:00Z"),
          ownerId: "user-2",
          owner: { displayName: "Bruno" },
        },
      }],
      meetings: [{
        id: "meeting-1",
        title: "Reunião de alinhamento",
        description: "Pauta: revisão do cronograma.",
        startAt: new Date("2026-08-01T12:00:00Z"),
        endAt: null,
        responsibleId: "user-3",
        responsible: { displayName: "Carla" },
        participants: [{ user: { displayName: "Elis" } }, { user: { displayName: "Fábio" } }],
        category: "MEETING",
        opportunityId: null,
        tenderId: null,
      }],
    });

    expect(entries.map((entry) => entry.type)).toEqual(["MEETING", "DELIVERY", "DEADLINE"]);
    expect(entries[0]).toMatchObject({ id: "meeting-1", editable: true, href: undefined, category: "MEETING", description: "Pauta: revisão do cronograma.", participantNames: ["Elis", "Fábio"] });
    expect(entries[1]).toMatchObject({ id: "proposal-1", editable: false, href: "/opportunities/opportunity-1" });
    expect(entries[2]).toMatchObject({ id: "deadline-1", editable: false, href: "/tenders/tender-1" });
  });

  it("ignora proposta sem data de entrega herdada da oportunidade", () => {
    const entries = mergeCalendarEntries({
      deadlines: [],
      proposals: [{
        id: "proposal-2",
        code: "PPB-002-26",
        opportunity: { id: "opportunity-2", deliveryAt: null, ownerId: null, owner: null },
      }],
      meetings: [],
    });

    expect(entries).toEqual([]);
  });

  it("vincula compromisso de equipe à oportunidade ou ao edital quando informado", () => {
    const entries = mergeCalendarEntries({
      deadlines: [],
      proposals: [],
      meetings: [{
        id: "meeting-2",
        title: "Visita técnica",
        description: null,
        startAt: new Date("2026-08-01T12:00:00Z"),
        endAt: new Date("2026-08-01T14:00:00Z"),
        responsibleId: "user-4",
        responsible: { displayName: "Diana" },
        participants: [],
        category: "TRAVEL",
        opportunityId: "opportunity-3",
        tenderId: null,
      }],
    });

    expect(entries[0]).toMatchObject({ href: "/opportunities/opportunity-3", endAt: "2026-08-01T14:00:00.000Z", category: "TRAVEL" });
    expect(entries[0].description).toBeUndefined();
    expect(entries[0].participantNames).toBeUndefined();
  });
});
