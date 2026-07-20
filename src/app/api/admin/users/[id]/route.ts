import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireMaster } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { ConflictError, ResourceNotFoundError, ValidationError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { userAccessSchema } from "@/modules/admin/user-access-schema";

export async function PATCH(request: Request, route: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requireMaster();
      const userId = z.uuid().parse((await route.params).id);
      const input = userAccessSchema.parse(await request.json());
      const database = getDatabase();
      const current = await database.user.findUnique({ where: { id: userId }, select: { id: true, isMaster: true } });
      if (!current) throw new ResourceNotFoundError("Usuário não encontrado.");
      if (await database.user.findFirst({ where: { email: input.email, id: { not: userId } }, select: { id: true } })) throw new ConflictError("Já existe outro usuário com este e-mail.");
      if (input.departmentId && !await database.department.findFirst({ where: { id: input.departmentId, active: true }, select: { id: true } })) throw new ValidationError("O departamento selecionado não está disponível.");
      if (current.isMaster && (!input.isMaster || input.status !== "ACTIVE")) {
        const otherMasters = await database.user.count({ where: { isMaster: true, status: "ACTIVE", id: { not: userId } } });
        if (!otherMasters) throw new ConflictError("O sistema deve manter pelo menos um usuário mestre ativo.");
      }
      const permissionIds = [...new Set(input.permissionIds)];
      if (await database.permission.count({ where: { id: { in: permissionIds } } }) !== permissionIds.length) throw new ValidationError("Uma ou mais permissões selecionadas são inválidas.");
      const now = new Date();
      const profileCode = `USER_ACCESS_${userId.replaceAll("-", "")}`;
      await database.$transaction(async (transaction) => {
        await transaction.user.update({ where: { id: userId }, data: { displayName: input.displayName, email: input.email, status: input.status, isMaster: input.isMaster, departmentId: input.departmentId ?? null, updatedBy: authorization.actorId } });
        const profile = await transaction.profile.upsert({ where: { code: profileCode }, create: { id: randomUUID(), code: profileCode, name: `Acesso individual — ${input.displayName}`, description: "Perfil individual administrado pelo painel de usuários.", createdBy: authorization.actorId, updatedBy: authorization.actorId }, update: { name: `Acesso individual — ${input.displayName}`, active: true, updatedBy: authorization.actorId } });
        await transaction.userProfile.updateMany({ where: { userId, validTo: null, profileId: { not: profile.id } }, data: { validTo: now } });
        await transaction.userProfile.upsert({ where: { userId_profileId: { userId, profileId: profile.id } }, create: { userId, profileId: profile.id, grantedBy: authorization.actorId, reason: "Permissões definidas pelo painel administrativo" }, update: { validFrom: now, validTo: null, grantedAt: now, grantedBy: authorization.actorId, reason: "Permissões atualizadas pelo painel administrativo" } });
        await transaction.profilePermission.deleteMany({ where: { profileId: profile.id } });
        if (permissionIds.length) await transaction.profilePermission.createMany({ data: permissionIds.map((permissionId) => ({ profileId: profile.id, permissionId, grantedBy: authorization.actorId })) });
        await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId: authorization.actorId, action: "USER_ACCESS_UPDATED", entityType: "USER", entityId: userId, correlationId: context.correlationId, outcome: "SUCCESS", origin: "admin-user-management", metadata: { isMaster: input.isMaster, status: input.status, permissionCount: permissionIds.length } } });
      });
      revalidatePath("/admin");
      return NextResponse.json({ data: { id: userId }, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
