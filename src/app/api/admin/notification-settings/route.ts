import { NextResponse } from "next/server";

import { requireMaster, requireOwner } from "@/core/authorization/authorization-context";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { NotificationSettingsService, notificationSettingsPatchSchema } from "@/modules/admin/notification-settings-service";

export async function GET(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      await requireMaster();
      const data = await new NotificationSettingsService().get();
      return NextResponse.json({ data, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requireOwner();
      const input = notificationSettingsPatchSchema.parse(await request.json());
      const data = await new NotificationSettingsService().setEmailSender(input.emailSender, authorization.actorId);
      return NextResponse.json({ data, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
