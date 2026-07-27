import { randomUUID } from "node:crypto";

import { getDatabase } from "@/core/database/prisma";
import type { CalendarEvent as PrismaCalendarEvent } from "@/generated/prisma/client";
import type {
  CalendarEventRecord,
  CalendarEventRepository,
} from "@/modules/calendar/application/calendar-service";
import type { CalendarEventDraft } from "@/modules/calendar/domain/calendar-event";
import {
  MicrosoftGraphCalendarProvider,
  type GraphCalendarEventInput,
  type GraphCalendarSyncResult,
} from "@/modules/calendar/infrastructure/microsoft-graph-calendar-provider";

const GRAPH_SOURCE = "MICROSOFT_GRAPH";

export class CalendarEventConcurrencyError extends Error {
  constructor(id: string) {
    super(`O compromisso foi alterado por outra operação: ${id}`);
    this.name = "CalendarEventConcurrencyError";
  }
}

export class PrismaCalendarRepository implements CalendarEventRepository {
  constructor(private readonly graphProvider: MicrosoftGraphCalendarProvider = new MicrosoftGraphCalendarProvider()) {}

  async create(draft: CalendarEventDraft, actorId: string, correlationId: string): Promise<CalendarEventRecord> {
    const database = getDatabase();

    const event = await database.$transaction(async (transaction) => {
      const created = await transaction.calendarEvent.create({
        data: {
          id: randomUUID(),
          ...this.persistenceFields(draft),
          status: "SCHEDULED",
          version: 1,
          createdBy: actorId,
          updatedBy: actorId,
          attendees: { create: draft.attendeeIds.map((userId) => ({ userId })) },
        },
      });

      await transaction.auditEvent.create({
        data: {
          id: randomUUID(),
          actorType: "USER",
          actorId,
          action: "CALENDAR_EVENT_CREATED",
          entityType: "CALENDAR_EVENT",
          entityId: created.id,
          correlationId,
          outcome: "SUCCESS",
          origin: "calendar-service",
          metadata: { title: created.title, startAt: created.startAt.toISOString() },
        },
      });

      return created;
    });

    await this.syncCreateToGraph(event, draft);
    return this.toRecord(event, draft.attendeeIds);
  }

  async findById(id: string): Promise<CalendarEventRecord | null> {
    const event = await getDatabase().calendarEvent.findUnique({ where: { id }, include: { attendees: { select: { userId: true } } } });
    return event ? this.toRecord(event, event.attendees.map((attendee) => attendee.userId)) : null;
  }

  async update(record: CalendarEventRecord, draft: CalendarEventDraft, actorId: string, correlationId: string): Promise<CalendarEventRecord> {
    const database = getDatabase();

    const saved = await database.$transaction(async (transaction) => {
      const result = await transaction.calendarEvent.updateMany({
        where: { id: record.id, version: record.version },
        data: {
          ...this.persistenceFields(draft),
          version: record.version + 1,
          updatedBy: actorId,
        },
      });

      if (result.count !== 1) throw new CalendarEventConcurrencyError(record.id);

      await transaction.calendarEventAttendee.deleteMany({ where: { calendarEventId: record.id } });
      if (draft.attendeeIds.length) {
        await transaction.calendarEventAttendee.createMany({ data: draft.attendeeIds.map((userId) => ({ calendarEventId: record.id, userId })) });
      }

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

      return transaction.calendarEvent.findUniqueOrThrow({ where: { id: record.id } });
    });

    await this.syncUpdateToGraph(saved, draft, draft.responsibleId !== record.responsibleId ? record.responsibleId : null);
    return this.toRecord(saved, draft.attendeeIds);
  }

  async cancel(record: CalendarEventRecord, actorId: string, correlationId: string): Promise<CalendarEventRecord> {
    const database = getDatabase();

    const saved = await database.$transaction(async (transaction) => {
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

      return transaction.calendarEvent.findUniqueOrThrow({ where: { id: record.id } });
    });

    await this.syncCancelToGraph(saved);
    return this.toRecord(saved, record.attendeeIds);
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

  private toRecord(model: PrismaCalendarEvent, attendeeIds: readonly string[]): CalendarEventRecord {
    return Object.freeze({
      id: model.id,
      title: model.title,
      startAt: model.startAt,
      allDay: model.allDay,
      category: model.category,
      responsibleId: model.responsibleId,
      attendeeIds: [...attendeeIds],
      status: model.status,
      version: model.version,
      ...(model.description && { description: model.description }),
      ...(model.endAt && { endAt: model.endAt }),
      ...(model.opportunityId && { opportunityId: model.opportunityId }),
      ...(model.proposalId && { proposalId: model.proposalId }),
      ...(model.tenderId && { tenderId: model.tenderId }),
    });
  }

  private async toGraphEventInput(model: Pick<PrismaCalendarEvent, "title" | "description" | "startAt" | "endAt" | "allDay" | "category">, attendeeIds: readonly string[]): Promise<GraphCalendarEventInput> {
    const attendees = attendeeIds.length ? await getDatabase().user.findMany({ where: { id: { in: [...attendeeIds] }, status: "ACTIVE" }, select: { email: true } }) : [];
    return {
      title: model.title,
      ...(model.description && { description: model.description }),
      startAt: model.startAt,
      ...(model.endAt && { endAt: model.endAt }),
      allDay: model.allDay,
      attendeeEmails: attendees.map((attendee) => attendee.email),
      onlineMeeting: model.category === "MEETING",
    };
  }

  private async persistGraphResult(id: string, result: GraphCalendarSyncResult): Promise<void> {
    if (result.status !== "SYNCED") return;
    await getDatabase().calendarEvent.update({
      where: { id },
      data: {
        externalId: result.externalId,
        externalSource: result.externalId ? GRAPH_SOURCE : null,
      },
    });
  }

  // A sincronização com o Outlook/Teams é melhor esforço: uma falha aqui não pode
  // impedir a criação/edição/cancelamento do compromisso dentro do G-SIPRO.
  private async syncCreateToGraph(event: PrismaCalendarEvent, draft: CalendarEventDraft): Promise<void> {
    try {
      const responsible = await getDatabase().user.findUnique({ where: { id: event.responsibleId }, select: { email: true } });
      if (!responsible) return;
      const result = await this.graphProvider.createEvent(responsible.email, await this.toGraphEventInput(event, draft.attendeeIds.filter((id) => id !== event.responsibleId)));
      await this.persistGraphResult(event.id, result);
    } catch {
      // melhor esforço — ver comentário acima.
    }
  }

  private async syncUpdateToGraph(saved: PrismaCalendarEvent, draft: CalendarEventDraft, previousResponsibleId: string | null): Promise<void> {
    try {
      const database = getDatabase();
      const responsible = await database.user.findUnique({ where: { id: saved.responsibleId }, select: { email: true } });
      if (!responsible) return;
      const event = await this.toGraphEventInput(saved, draft.attendeeIds.filter((id) => id !== saved.responsibleId));
      const alreadySynced = Boolean(saved.externalId) && saved.externalSource === GRAPH_SOURCE;

      if (previousResponsibleId && alreadySynced) {
        const previousUser = await database.user.findUnique({ where: { id: previousResponsibleId }, select: { email: true } });
        if (previousUser) await this.graphProvider.deleteEvent(previousUser.email, saved.externalId!);
        const result = await this.graphProvider.createEvent(responsible.email, event);
        await this.persistGraphResult(saved.id, result);
        return;
      }

      const result = alreadySynced
        ? await this.graphProvider.updateEvent(responsible.email, saved.externalId!, event)
        : await this.graphProvider.createEvent(responsible.email, event);
      await this.persistGraphResult(saved.id, result);
    } catch {
      // melhor esforço — ver comentário acima.
    }
  }

  private async syncCancelToGraph(saved: PrismaCalendarEvent): Promise<void> {
    if (!saved.externalId || saved.externalSource !== GRAPH_SOURCE) return;
    try {
      const responsible = await getDatabase().user.findUnique({ where: { id: saved.responsibleId }, select: { email: true } });
      if (!responsible) return;
      const result = await this.graphProvider.deleteEvent(responsible.email, saved.externalId);
      await this.persistGraphResult(saved.id, result);
    } catch {
      // melhor esforço — ver comentário acima.
    }
  }
}
