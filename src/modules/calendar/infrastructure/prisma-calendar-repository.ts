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
import { MicrosoftGraphNotificationProvider } from "@/modules/opportunity-intelligence/infrastructure/microsoft-graph-notification-provider";

const GRAPH_SOURCE = "MICROSOFT_GRAPH";

type CalendarEventWithParticipants = PrismaCalendarEvent & { participants: { userId: string }[] };

export class CalendarEventConcurrencyError extends Error {
  constructor(id: string) {
    super(`O compromisso foi alterado por outra operação: ${id}`);
    this.name = "CalendarEventConcurrencyError";
  }
}

export class PrismaCalendarRepository implements CalendarEventRepository {
  constructor(
    private readonly graphProvider: MicrosoftGraphCalendarProvider = new MicrosoftGraphCalendarProvider(),
    private readonly notificationProvider: MicrosoftGraphNotificationProvider = new MicrosoftGraphNotificationProvider(),
  ) {}

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
          participants: { createMany: { data: this.participantRows(draft) } },
        },
        include: { participants: true },
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

    await this.syncCreateToGraph(event);
    await this.notifyDelegatedResponsible(event, actorId);
    return this.toRecord(event);
  }

  async findById(id: string): Promise<CalendarEventRecord | null> {
    const event = await getDatabase().calendarEvent.findUnique({ where: { id }, include: { participants: true } });
    return event ? this.toRecord(event) : null;
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

      await transaction.calendarEventParticipant.deleteMany({ where: { calendarEventId: record.id } });
      const rows = this.participantRows(draft);
      if (rows.length > 0) {
        await transaction.calendarEventParticipant.createMany({
          data: rows.map((row) => ({ ...row, calendarEventId: record.id })),
        });
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

      return transaction.calendarEvent.findUniqueOrThrow({ where: { id: record.id }, include: { participants: true } });
    });

    const responsibleChanged = draft.responsibleId !== record.responsibleId;
    await this.syncUpdateToGraph(saved, responsibleChanged ? record.responsibleId : null);
    if (responsibleChanged) await this.notifyDelegatedResponsible(saved, actorId);
    return this.toRecord(saved);
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

      return transaction.calendarEvent.findUniqueOrThrow({ where: { id: record.id }, include: { participants: true } });
    });

    await this.syncCancelToGraph(saved);
    return this.toRecord(saved);
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

  // O responsável já é o dono da agenda onde o evento é criado — inclui-lo também
  // como participante geraria um convidado duplicado do próprio organizador.
  private participantRows(draft: CalendarEventDraft): { id: string; userId: string }[] {
    const uniqueIds = [...new Set(draft.participantIds)].filter((userId) => userId !== draft.responsibleId);
    return uniqueIds.map((userId) => ({ id: randomUUID(), userId }));
  }

  private toRecord(model: CalendarEventWithParticipants): CalendarEventRecord {
    return Object.freeze({
      id: model.id,
      title: model.title,
      startAt: model.startAt,
      allDay: model.allDay,
      category: model.category,
      responsibleId: model.responsibleId,
      participantIds: model.participants.map((participant) => participant.userId),
      status: model.status,
      version: model.version,
      ...(model.description && { description: model.description }),
      ...(model.endAt && { endAt: model.endAt }),
      ...(model.opportunityId && { opportunityId: model.opportunityId }),
      ...(model.proposalId && { proposalId: model.proposalId }),
      ...(model.tenderId && { tenderId: model.tenderId }),
    });
  }

  private async toGraphEventInput(
    model: Pick<PrismaCalendarEvent, "title" | "description" | "startAt" | "endAt" | "allDay">,
    participantUserIds: readonly string[],
  ): Promise<GraphCalendarEventInput> {
    const attendees = participantUserIds.length > 0
      ? await getDatabase().user.findMany({ where: { id: { in: [...participantUserIds] } }, select: { email: true, displayName: true } })
      : [];
    return {
      title: model.title,
      ...(model.description && { description: model.description }),
      startAt: model.startAt,
      ...(model.endAt && { endAt: model.endAt }),
      allDay: model.allDay,
      attendees: attendees.map((attendee) => ({ email: attendee.email, name: attendee.displayName })),
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
  private async syncCreateToGraph(event: CalendarEventWithParticipants): Promise<void> {
    try {
      const responsible = await getDatabase().user.findUnique({ where: { id: event.responsibleId }, select: { email: true } });
      if (!responsible) return;
      const input = await this.toGraphEventInput(event, event.participants.map((participant) => participant.userId));
      const result = await this.graphProvider.createEvent(responsible.email, input);
      await this.persistGraphResult(event.id, result);
    } catch {
      // melhor esforço — ver comentário acima.
    }
  }

  private async syncUpdateToGraph(saved: CalendarEventWithParticipants, previousResponsibleId: string | null): Promise<void> {
    try {
      const database = getDatabase();
      const responsible = await database.user.findUnique({ where: { id: saved.responsibleId }, select: { email: true } });
      if (!responsible) return;
      const event = await this.toGraphEventInput(saved, saved.participants.map((participant) => participant.userId));
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

  // Quando alguém marca um compromisso em nome de outra pessoa, o evento é criado
  // direto na agenda do responsável via Graph — como ele é o próprio dono do
  // evento, o Outlook não dispara nenhum aviso automático (isso só acontece para
  // convidados). Sem este e-mail, o responsável nunca ficava sabendo do compromisso.
  private async notifyDelegatedResponsible(
    event: Pick<PrismaCalendarEvent, "id" | "title" | "startAt" | "responsibleId">,
    actorId: string,
  ): Promise<void> {
    if (event.responsibleId === actorId) return;
    try {
      const database = getDatabase();
      const [responsible, actor] = await Promise.all([
        database.user.findUnique({ where: { id: event.responsibleId }, select: { email: true, teamsProvisioningStatus: true } }),
        database.user.findUnique({ where: { id: actorId }, select: { displayName: true } }),
      ]);
      if (!responsible) return;
      await this.notificationProvider.sendEmail({
        recipientEmail: responsible.email,
        recipientTeamsStatus: responsible.teamsProvisioningStatus,
        summary: `${actor?.displayName ?? "Alguém"} marcou um compromisso para você: ${event.title}`,
        nextAction: "Confira o horário no Calendário do G-SIPRO ou no seu Outlook.",
        deepLink: "/calendar",
        eventId: event.id,
      });
    } catch {
      // melhor esforço — não pode impedir a criação/atualização do compromisso.
    }
  }

  private async syncCancelToGraph(saved: CalendarEventWithParticipants): Promise<void> {
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
