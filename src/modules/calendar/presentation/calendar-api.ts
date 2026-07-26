import { ConflictError, ResourceNotFoundError, ValidationError } from "@/core/errors/application-error";
import { CalendarEventNotFoundError } from "@/modules/calendar/application/calendar-service";
import { CalendarEventRuleError } from "@/modules/calendar/domain/calendar-event";
import { CalendarEventConcurrencyError } from "@/modules/calendar/infrastructure/prisma-calendar-repository";

export function mapCalendarApiError(error: unknown): never {
  if (error instanceof CalendarEventNotFoundError) throw new ResourceNotFoundError(error.message);
  if (error instanceof CalendarEventRuleError) throw new ValidationError(error.message);
  if (error instanceof CalendarEventConcurrencyError) throw new ConflictError(error.message);
  throw error;
}
