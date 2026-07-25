import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { requireMaster } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { ConflictError, ValidationError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { provisionTeamsAppForManagedUser, resolveEntraIdentityByEmail } from "@/modules/admin/microsoft-graph-teams-provisioner";
import { userAccessDisposition } from "@/modules/admin/user-access-authority";
import { userAccessSchema } from "@/modules/admin/user-access-schema";

export async function POST(request: Request): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requireMaster();
      const input = userAccessSchema.parse(await request.json());
      const database = getDatabase();
      const disposition = userAccessDisposition({ actorIsOwner: Boolean(authorization.isOwner), requestedIsMaster: input.isMaster, requestedIsOwner: input.isOwner });
      if (disposition === "FORBIDDEN") throw new ConflictError("Somente o proprietário pode cadastrar outro proprietário.");
      if (await database.user.findUnique({ where: { email: input.email }, select: { id: true } })) throw new ConflictError("Já existe um usuário com este e-mail.");
      if (input.departmentId && !await database.department.findFirst({ where: { id: input.departmentId, active: true }, select: { id: true } })) throw new ValidationError("O departamento selecionado não está disponível.");
      const permissionCount = await database.permission.count({ where: { id: { in: input.permissionIds } } });
      if (permissionCount !== new Set(input.permissionIds).size) throw new ValidationError("Uma ou mais permissões selecionadas são inválidas.");

      if (disposition === "OWNER_APPROVAL") {
        const requestId = randomUUID();
        await database.$transaction(async transaction => {
          await transaction.userAccessRequest.create({ data: { id: requestId, action: "CREATE", requestedById: authorization.actorId, payload: input } });
          await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId: authorization.actorId, action: "MASTER_ACCESS_REQUESTED", entityType: "USER_ACCESS_REQUEST", entityId: requestId, correlationId: context.correlationId, outcome: "SUCCESS", origin: "admin-user-management", metadata: { email: input.email, requestedRole: "MASTER" } } });
        });
        revalidatePath("/admin");
        return NextResponse.json({ data: { requestId, pendingApproval: true }, correlationId: context.correlationId }, { status: 202 });
      }

      const userId = randomUUID();
      const profileId = randomUUID();
      const entraIdentity = await resolveEntraIdentityByEmail(input.email);
      await database.$transaction(async (transaction) => {
        await transaction.user.create({ data: { id: userId, entraObjectId: entraIdentity.objectId ?? userId, displayName: input.displayName, email: input.email, status: input.status, isMaster: input.isMaster, isOwner: input.isOwner, departmentId: input.departmentId ?? null, createdBy: authorization.actorId, updatedBy: authorization.actorId } });
        await transaction.profile.create({ data: { id: profileId, code: `USER_ACCESS_${userId.replaceAll("-", "")}`, name: `Acesso individual — ${input.displayName}`, description: "Perfil individual administrado pelo painel de usuários.", createdBy: authorization.actorId, updatedBy: authorization.actorId } });
        if (input.permissionIds.length) await transaction.profilePermission.createMany({ data: [...new Set(input.permissionIds)].map((permissionId) => ({ profileId, permissionId, grantedBy: authorization.actorId })) });
        await transaction.userProfile.create({ data: { userId, profileId, grantedBy: authorization.actorId, reason: "Provisionamento pelo painel administrativo" } });
        await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId: authorization.actorId, action: "USER_PROVISIONED", entityType: "USER", entityId: userId, correlationId: context.correlationId, outcome: "SUCCESS", origin: "admin-user-management", metadata: { email: input.email, isMaster: input.isMaster, isOwner: input.isOwner, permissionCount: input.permissionIds.length, entraIdentityStatus: entraIdentity.status, entraIdentityErrorCode: entraIdentity.errorCode } } });
      });
      const teamsProvisioning = input.status === "ACTIVE"
        ? await provisionTeamsAppForManagedUser({ userId, email: input.email, actorId: authorization.actorId, correlationId: context.correlationId })
        : null;
      revalidatePath("/admin");
      return NextResponse.json({ data: { id: userId, entraIdentity, teamsProvisioning }, correlationId: context.correlationId }, { status: 201 });
    } catch (error) {
      return toApiError(error);
    }
  });
}
