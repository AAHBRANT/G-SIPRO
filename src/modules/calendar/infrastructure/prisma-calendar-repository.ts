import { randomUUID } from "node:crypto";

import { getDatabase } from "@/core/database/prisma";
import type { CalendarEvent as PrismaCalendarEvent } from "@/generated/prisma/client";
import type {
  CalendarEventRecord,
  CalendarEventRepository,
} from "@/modules/calendar/application/calendar-service";
import type { CalendarEventDraft } from "@/modules/calendar/domain/calendar-event";

export class CalendarEventConcurrencyError extends Error {
  constructor(id: string) {
    super(`O compromisso foi alterado por outra operação: ${id}`);
    this.name = "CalendarEventConcurrencyError";
  }
}

export class PrismaCalendarRepository implements CalendarEventRepository {
  async create(draft: CalendarEventDraft, actorId: string, correlationId: string): Promise<CalendarEventRecord> {
    const database = getDatabase();

    return database.$transaction(async (transaction) => {
      const event = await transaction.calendarEvent.create({
        data: {
          id: randomUUID(),
          ...this.persistenceFields(draft),
          status: "SCHEDULED",
          version: 1,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });

      await transaction.auditEvent.create({
        data: {
          id: randomUUID(),
          actorType: "USER",
          actorId,
          action: "CALENDAR_EVENT_CREATED",
          entityType: "CALENDAR_EVENT",
          entityId: event.id,
          correlationId,
          outcome: "SUCCESS",
          origin: "calendar-service",
          metadata: { title: event.title, startAt: event.startAt.toISOString() },
        },
      });

      return this.toRecord(event);
    });
  }

  async findById(id: string): Promise<CalendarEventRecord | null> {
    const event = await getDatabase().calendarEvent.findUnique({ where: { id } });
    return event ? this.toRecord(event) : null;
  }

  async update(record: CalendarEventRecord, draft: CalendarEventDraft, actorId: string, correlationId: string): Promise<CalendarEventRecord> {
    const database = getDatabase();

    return database.$transaction(async (transaction) => {
      const result = await transaction.calendarEvent.updateMany({
        where: { id: record.id, version: record.version },
        data: {
          ...this.persistenceFields(draft),
          version: record.version + 1,
          updatedBy: actorId,
        },
      });

      if (result.count !== 1) throw new CalendarEventConcurrencyError(record.id);

      await transaction.auditEvent.create({
        data: {
          id: randomUUID(),
          actorType: "USER",
          actorId,
          action: "CALENDAR_EVENT_UPDATED",
          entityType: "CALENDAR_EVENT",
          entityId: record.id,
          correlationId,
          outcome: "SUCCESS",
          origin: "calendar-service",
          metadata: { version: record.version + 1 },
        },
      });

      const saved = await transaction.calendarEvent.findUniqueOrThrow({ where: { id: record.id } });
      return this.toRecord(saved);
    });
  }

  async cancel(record: CalendarEventRecord, actorId: string, correlationId: string): Promise<CalendarEventRecord> {
    const database = getDatabase();

    return database.$transaction(async (transaction) => {
      const result = await transaction.calendarEvent.updateMany({
        where: { id: record.id, version: record.version },
        data: { status: "CANCELLED", version: record.version + 1, updatedBy: actorId },
      });

      if (result.count !== 1) throw new CalendarEventConcurrencyError(record.id);

      await transaction.auditEvent.create({
        data: {
          id: randomUUID(),
          actorType: "USER",
          actorId,
          action: "CALENDAR_EVENT_CANCELLED",
          entityType: "CALENDAR_EVENT",
          entityId: record.id,
          correlationId,
          outcome: "SUCCESS",
          origin: "calendar-service",
          metadata: { version: record.version + 1 },
        },
      });

      const saved = await transaction.calendarEvent.findUniqueOrThrow({ where: { id: record.id } });
      return this.toRecord(saved);
    });
  }

  private persistenceFields(draft: CalendarEventDraft) {
    return {
      title: draft.title,
      description: draft.description ?? null,
      startAt: draft.startAt,
      endAt: draft.endAt ?? null,
      allDay: draft.allDay,
      category: draft.category,
      responsibleId: draft.responsibleId,
      opportunityId: draft.opportunityId ?? null,
      proposalId: draft.proposalId ?? null,
      tenderId: draft.tenderId ?? null,
    };
  }

  private toRecord(model: PrismaCalendarEvent): CalendarEventRecord {
    return Object.freeze({
      id: model.id,
      title: model.title,
      startAt: model.startAt,
      allDay: model.allDay,
      category: model.category,
      responsibleId: model.responsibleId,
      status: model.status,
      version: model.version,
      ...(model.description && { description: model.description }),
      ...(model.endAt && { endAt: model.endAt }),
      ...(model.opportunityId && { opportunityId: model.opportunityId }),
      ...(model.proposalId && { proposalId: model.proposalId }),
      ...(model.tenderId && { tenderId: model.tenderId }),
    });
  }
}
