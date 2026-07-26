import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { CalendarService } from "@/modules/calendar/application/calendar-service";
import { mergeCalendarEntries } from "@/modules/calendar/domain/calendar-entry";
import { PrismaCalendarRepository } from "@/modules/calendar/infrastructure/prisma-calendar-repository";
import { mapCalendarApiError } from "@/modules/calendar/presentation/calendar-api";

const filtersSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export async function GET(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      await requirePermission("calendar.read");
      const url = new URL(request.url);
      const filters = filtersSchema.parse({
        from: url.searchParams.get("from") || undefined,
        to: url.searchParams.get("to") || undefined,
      });
      const database = getDatabase();
      const dateRange = {
        ...(filters.from && { gte: filters.from }),
        ...(filters.to && { lte: filters.to }),
      };

      const [deadlines, proposals, meetings] = await Promise.all([
        database.tenderDeadline.findMany({
          where: {
            status: { in: ["PENDING_CONFIRMATION", "CONFIRMED"] },
            ...(Object.keys(dateRange).length > 0 && { dueAt: dateRange }),
          },
          include: { responsible: true, tender: { select: { id: true, code: true } } },
          orderBy: { dueAt: "asc" },
          take: 200,
        }),
        database.proposal.findMany({
          where: {
            deletedAt: null,
            status: { notIn: ["FINALIZED", "CANCELLED", "CLOSED", "JUDGED"] },
            opportunity: { deliveryAt: { not: null, ...dateRange } },
          },
          include: { opportunity: { select: { id: true, deliveryAt: true, ownerId: true, owner: true } } },
          orderBy: { opportunity: { deliveryAt: "asc" } },
          take: 200,
        }),
        database.calendarEvent.findMany({
          where: {
            status: "SCHEDULED",
            ...(Object.keys(dateRange).length > 0 && { startAt: dateRange }),
          },
          include: { responsible: true },
          orderBy: { startAt: "asc" },
          take: 200,
        }),
      ]);

      const entries = mergeCalendarEntries({ deadlines, proposals, meetings });

      return NextResponse.json({ data: entries, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("calendar.manage");
      const body: unknown = await request.json();
      const service = new CalendarService(new PrismaCalendarRepository());
      const event = await service.create(body, authorization.actorId, context.correlationId);
      return NextResponse.json({ data: event, correlationId: context.correlationId }, { status: 201 });
    } catch (error) {
      try {
        mapCalendarApiError(error);
      } catch (mapped) {
        return toApiError(mapped);
      }
    }
  });
}
