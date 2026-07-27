import { z } from "zod";

export const calendarEventStatuses = ["SCHEDULED", "CANCELLED"] as const;
export type CalendarEventStatus = (typeof calendarEventStatuses)[number];

export const calendarEventCategories = ["MEETING", "TRAVEL", "INTERNAL_DEADLINE", "PERSONAL", "OTHER"] as const;
export type CalendarEventCategory = (typeof calendarEventCategories)[number];

const linkFields = ["opportunityId", "proposalId", "tenderId"] as const;

const calendarEventBaseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
  allDay: z.boolean().default(false),
  category: z.enum(calendarEventCategories).default("MEETING"),
  responsibleId: z.uuid(),
  attendeeIds: z.array(z.uuid()).max(100).default([]),
  opportunityId: z.uuid().optional(),
  proposalId: z.uuid().optional(),
  tenderId: z.uuid().optional(),
});

function checkCalendarEvent(value: z.infer<typeof calendarEventBaseSchema>, context: z.RefinementCtx) {
  if (value.endAt && value.endAt < value.startAt) {
    context.addIssue({ code: "custom", path: ["endAt"], message: "O término deve ser posterior ao início." });
  }
  const linkedCount = linkFields.filter((field) => value[field]).length;
  if (linkedCount > 1) {
    context.addIssue({ code: "custom", path: ["opportunityId"], message: "Um compromisso só pode estar vinculado a um único registro (oportunidade, proposta ou edital)." });
  }
  if (new Set(value.attendeeIds).size !== value.attendeeIds.length) {
    context.addIssue({ code: "custom", path: ["attendeeIds"], message: "Cada participante deve ser informado uma única vez." });
  }
}

export const calendarEventSchema = calendarEventBaseSchema.superRefine(checkCalendarEvent);
export const calendarEventPatchSchema = calendarEventBaseSchema.partial();

export type CalendarEventDraft = z.infer<typeof calendarEventSchema>;
export type CalendarEventPatch = z.infer<typeof calendarEventPatchSchema>;

export class CalendarEventRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarEventRuleError";
  }
}

export function assertCalendarEventCancellable(status: CalendarEventStatus): void {
  if (status === "CANCELLED") {
    throw new CalendarEventRuleError("O compromisso já está cancelado.");
  }
}
