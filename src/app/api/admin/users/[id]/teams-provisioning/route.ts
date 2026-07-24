import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireMaster } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { ConflictError, ResourceNotFoundError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { provisionTeamsAppForManagedUser } from "@/modules/admin/microsoft-graph-teams-provisioner";

export async function POST(request: Request, route: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requireMaster();
      const userId = z.uuid().parse((await route.params).id);
      const user = await getDatabase().user.findUnique({ where: { id: userId }, select: { id: true, email: true, status: true } });
      if (!user) throw new ResourceNotFoundError("Usuário não encontrado.");
      if (user.status !== "ACTIVE") throw new ConflictError("Ative o usuário antes de instalar o aplicativo no Teams.");
      const teamsProvisioning = await provisionTeamsAppForManagedUser({
        userId,
        email: user.email,
        actorId: authorization.actorId,
        correlationId: context.correlationId,
      });
      revalidatePath("/admin");
      return NextResponse.json({ data: { id: userId, teamsProvisioning }, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
