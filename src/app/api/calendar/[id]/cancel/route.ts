import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { CalendarService } from "@/modules/calendar/application/calendar-service";
import { PrismaCalendarRepository } from "@/modules/calendar/infrastructure/prisma-calendar-repository";
import { mapCalendarApiError } from "@/modules/calendar/presentation/calendar-api";

export async function POST(request: Request, route: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("calendar.manage");
      const id = z.uuid().parse((await route.params).id);
      const service = new CalendarService(new PrismaCalendarRepository());
      const event = await service.cancel(id, authorization.actorId, context.correlationId);
      return NextResponse.json({ data: event, correlationId: context.correlationId });
    } catch (error) {
      try {
        mapCalendarApiError(error);
      } catch (mapped) {
        return toApiError(mapped);
      }
    }
  });
}
