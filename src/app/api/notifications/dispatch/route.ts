import { NextResponse } from "next/server";
import { z } from "zod";

import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { NotificationDispatchService } from "@/modules/opportunity-intelligence/application/notification-dispatch-service";
import { requireNotificationDispatcher } from "@/modules/opportunity-intelligence/infrastructure/notification-dispatch-auth";

const commandSchema = z.object({ limit: z.number().int().min(1).max(50).default(20) }).strict();

export async function POST(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      requireNotificationDispatcher(request);
      const command = commandSchema.parse(await request.json().catch(() => ({})));
      const data = await new NotificationDispatchService().dispatch(command.limit);
      return NextResponse.json({ data, count: data.length, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
