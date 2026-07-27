import { z } from "zod";

export const calendarEventStatuses = ["SCHEDULED", "CANCELLED"] as const;
export type CalendarEventStatus = (typeof calendarEventStatuses)[number];

export const calendarEventCategories = ["MEETING", "TRAVEL", "INTERNAL_DEADLINE", "PERSONAL", "OTHER"] as const;
export type CalendarEventCategory = (typeof calendarEventCategories)[number];

const linkFields = ["opportunityId", "proposalId", "tenderId"] as const;

// O formulário de compromisso (<input type="datetime-local">) envia um horário
// "ingênuo", sem fuso (ex.: "2026-08-10T14:00") — o horário que o usuário
// realmente digitou em Brasília. Sem isso, o servidor (que roda em UTC no
// Azure) interpretaria esse mesmo texto como UTC, adiantando o compromisso
// em 3 horas em relação ao que foi marcado. O Brasil não usa horário de
// verão desde 2019, então o deslocamento fixo de -03:00 é sempre válido.
const BRASILIA_OFFSET = "-03:00";
const naiveLocalDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

function asBrasiliaDateTime(value: unknown) {
  if (typeof value === "string" && naiveLocalDateTime.test(value)) return `${value}${BRASILIA_OFFSET}`;
  return value;
}

const calendarEventBaseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  startAt: z.preprocess(asBrasiliaDateTime, z.coerce.date()),
  endAt: z.preprocess(asBrasiliaDateTime, z.coerce.date()).optional(),
  allDay: z.boolean().default(false),
  category: z.enum(calendarEventCategories).default("MEETING"),
  responsibleId: z.uuid(),
  participantIds: z.array(z.uuid()).max(20).default([]),
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
