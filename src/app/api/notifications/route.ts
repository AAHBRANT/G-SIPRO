import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";

const querySchema = z.object({
  unreadOnly: z.enum(["true", "false"]).default("false"),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export async function GET(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("notifications.read");
      const url = new URL(request.url);
      const query = querySchema.parse({
        unreadOnly: url.searchParams.get("unreadOnly") ?? undefined,
        limit: url.searchParams.get("limit") ?? undefined,
      });
      const where = {
        recipientId: authorization.actorId,
        ...(query.unreadOnly === "true" && { readAt: null }),
      };
      const [data, unreadCount] = await getDatabase().$transaction([
        getDatabase().userNotification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: query.limit,
        }),
        getDatabase().userNotification.count({
          where: { recipientId: authorization.actorId, readAt: null },
        }),
      ]);
      return NextResponse.json({ data, unreadCount, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
