import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { toApiError } from "@/core/errors/api-error";
import { ResourceNotFoundError } from "@/core/errors/application-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";

export async function POST(request: Request, route: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("notifications.read");
      const id = z.uuid().parse((await route.params).id);
      const updated = await getDatabase().userNotification.updateMany({
        where: { id, recipientId: authorization.actorId },
        data: { readAt: new Date() },
      });
      if (updated.count !== 1) throw new ResourceNotFoundError("Notificação não encontrada.");
      const data = await getDatabase().userNotification.findUniqueOrThrow({ where: { id } });
      return NextResponse.json({ data, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
