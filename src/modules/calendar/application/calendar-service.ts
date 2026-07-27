import { randomUUID } from "node:crypto";

import {
  assertCalendarEventCancellable,
  calendarEventPatchSchema,
  calendarEventSchema,
  type CalendarEventDraft,
  type CalendarEventStatus,
} from "@/modules/calendar/domain/calendar-event";

export type CalendarEventRecord = Readonly<
  CalendarEventDraft & {
    id: string;
    status: CalendarEventStatus;
    version: number;
  }
>;

export interface CalendarEventRepository {
  create(draft: CalendarEventDraft, actorId: string, correlationId: string): Promise<CalendarEventRecord>;
  findById(id: string): Promise<CalendarEventRecord | null>;
  update(record: CalendarEventRecord, draft: CalendarEventDraft, actorId: string, correlationId: string): Promise<CalendarEventRecord>;
  cancel(record: CalendarEventRecord, actorId: string, correlationId: string): Promise<CalendarEventRecord>;
}

export class CalendarEventNotFoundError extends Error {
  constructor(id: string) {
    super(`Compromisso não encontrado: ${id}`);
    this.name = "CalendarEventNotFoundError";
  }
}

export class CalendarService {
  constructor(private readonly repository: CalendarEventRepository) {}

  async create(input: unknown, actorId: string, correlationId: string = randomUUID()): Promise<CalendarEventRecord> {
    const draft = calendarEventSchema.parse(input);
    return this.repository.create(draft, actorId, correlationId);
  }

  async update(id: string, input: unknown, actorId: string, correlationId: string = randomUUID()): Promise<CalendarEventRecord> {
    const record = await this.requireRecord(id);
    assertCalendarEventCancellable(record.status);
    const patch = calendarEventPatchSchema.parse(input);
    const draft = calendarEventSchema.parse({ ...this.toDraft(record), ...patch });
    return this.repository.update(record, draft, actorId, correlationId);
  }

  async cancel(id: string, actorId: string, correlationId: string = randomUUID()): Promise<CalendarEventRecord> {
    const record = await this.requireRecord(id);
    assertCalendarEventCancellable(record.status);
    return this.repository.cancel(record, actorId, correlationId);
  }

  private async requireRecord(id: string): Promise<CalendarEventRecord> {
    const record = await this.repository.findById(id);
    if (!record) throw new CalendarEventNotFoundError(id);
    return record;
  }

  private toDraft(record: CalendarEventRecord): CalendarEventDraft {
    return {
      title: record.title,
      startAt: record.startAt,
      allDay: record.allDay,
      category: record.category,
      responsibleId: record.responsibleId,
      attendeeIds: record.attendeeIds,
      ...(record.description && { description: record.description }),
      ...(record.endAt && { endAt: record.endAt }),
      ...(record.opportunityId && { opportunityId: record.opportunityId }),
      ...(record.proposalId && { proposalId: record.proposalId }),
      ...(record.tenderId && { tenderId: record.tenderId }),
    };
  }
}
