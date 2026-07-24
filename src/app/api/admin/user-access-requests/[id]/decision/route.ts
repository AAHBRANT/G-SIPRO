import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireOwner } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { ConflictError, ResourceNotFoundError, ValidationError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { provisionTeamsAppForManagedUser } from "@/modules/admin/microsoft-graph-teams-provisioner";
import { userAccessSchema } from "@/modules/admin/user-access-schema";

const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().min(3).max(1_000),
});

export async function POST(request: Request, route: { params: Promise<{ id: string }> }) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requireOwner();
      const requestId = z.uuid().parse((await route.params).id);
      const input = decisionSchema.parse(await request.json());
      const database = getDatabase();
      const accessRequest = await database.userAccessRequest.findUnique({ where: { id: requestId } });
      if (!accessRequest) throw new ResourceNotFoundError("Solicitação de acesso não encontrada.");
      if (accessRequest.status !== "PENDING") throw new ConflictError("Esta solicitação já foi decidida.");

      if (input.decision === "REJECTED") {
        await database.$transaction(async transaction => {
          await transaction.userAccessRequest.update({ where: { id: requestId }, data: { status: "REJECTED", decisionNote: input.note, decidedById: authorization.actorId, decidedAt: new Date() } });
          await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId: authorization.actorId, action: "MASTER_ACCESS_REJECTED", entityType: "USER_ACCESS_REQUEST", entityId: requestId, correlationId: context.correlationId, outcome: "SUCCESS", origin: "admin-user-management", metadata: { action: accessRequest.action, targetUserId: accessRequest.targetUserId } } });
        });
        revalidatePath("/admin");
        return NextResponse.json({ data: { id: requestId, status: "REJECTED" }, correlationId: context.correlationId });
      }

      const draft = userAccessSchema.parse(accessRequest.payload);
      if (draft.isOwner && !draft.isMaster) throw new ConflictError("O proprietário deve permanecer como usuário mestre.");
      if (draft.departmentId && !await database.department.findFirst({ where: { id: draft.departmentId, active: true }, select: { id: true } })) throw new ValidationError("O departamento selecionado não está disponível.");
      const permissionIds = [...new Set(draft.permissionIds)];
      if (await database.permission.count({ where: { id: { in: permissionIds } } }) !== permissionIds.length) throw new ValidationError("Uma ou mais permissões selecionadas são inválidas.");

      const approvedUserId = accessRequest.action === "CREATE" ? randomUUID() : accessRequest.targetUserId;
      if (!approvedUserId) throw new ConflictError("A solicitação de alteração não informa o usuário de destino.");
      const conflictingUser = await database.user.findFirst({ where: { email: draft.email, id: { not: approvedUserId } }, select: { id: true } });
      if (conflictingUser) throw new ConflictError("Já existe outro usuário com este e-mail.");

      await database.$transaction(async transaction => {
        if (accessRequest.action === "CREATE") {
          const profileId = randomUUID();
          await transaction.user.create({ data: { id: approvedUserId, entraObjectId: randomUUID(), displayName: draft.displayName, email: draft.email, status: draft.status, isMaster: draft.isMaster, isOwner: draft.isOwner, departmentId: draft.departmentId ?? null, createdBy: authorization.actorId, updatedBy: authorization.actorId } });
          await transaction.profile.create({ data: { id: profileId, code: `USER_ACCESS_${approvedUserId.replaceAll("-", "")}`, name: `Acesso individual — ${draft.displayName}`, description: "Perfil individual administrado pelo painel de usuários.", createdBy: authorization.actorId, updatedBy: authorization.actorId } });
          if (permissionIds.length) await transaction.profilePermission.createMany({ data: permissionIds.map(permissionId => ({ profileId, permissionId, grantedBy: authorization.actorId })) });
          await transaction.userProfile.create({ data: { userId: approvedUserId, profileId, grantedBy: authorization.actorId, reason: "Provisionamento aprovado pelo proprietário" } });
        } else {
          const current = await transaction.user.findUnique({ where: { id: approvedUserId }, select: { id: true } });
          if (!current) throw new ResourceNotFoundError("Usuário de destino não encontrado.");
          const now = new Date();
          const profileCode = `USER_ACCESS_${approvedUserId.replaceAll("-", "")}`;
          await transaction.user.update({ where: { id: approvedUserId }, data: { displayName: draft.displayName, email: draft.email, status: draft.status, isMaster: draft.isMaster, isOwner: draft.isOwner, departmentId: draft.departmentId ?? null, updatedBy: authorization.actorId } });
          const profile = await transaction.profile.upsert({ where: { code: profileCode }, create: { id: randomUUID(), code: profileCode, name: `Acesso individual — ${draft.displayName}`, description: "Perfil individual administrado pelo painel de usuários.", createdBy: authorization.actorId, updatedBy: authorization.actorId }, update: { name: `Acesso individual — ${draft.displayName}`, active: true, updatedBy: authorization.actorId } });
          await transaction.userProfile.updateMany({ where: { userId: approvedUserId, validTo: null, profileId: { not: profile.id } }, data: { validTo: now } });
          await transaction.userProfile.upsert({ where: { userId_profileId: { userId: approvedUserId, profileId: profile.id } }, create: { userId: approvedUserId, profileId: profile.id, grantedBy: authorization.actorId, reason: "Alteração aprovada pelo proprietário" }, update: { validFrom: now, validTo: null, grantedAt: now, grantedBy: authorization.actorId, reason: "Alteração aprovada pelo proprietário" } });
          await transaction.profilePermission.deleteMany({ where: { profileId: profile.id } });
          if (permissionIds.length) await transaction.profilePermission.createMany({ data: permissionIds.map(permissionId => ({ profileId: profile.id, permissionId, grantedBy: authorization.actorId })) });
        }

        await transaction.userAccessRequest.update({ where: { id: requestId }, data: { status: "APPROVED", decisionNote: input.note, decidedById: authorization.actorId, decidedAt: new Date() } });
        await transaction.auditEvent.create({ data: { id: randomUUID(), actorType: "USER", actorId: authorization.actorId, action: "MASTER_ACCESS_APPROVED", entityType: "USER_ACCESS_REQUEST", entityId: requestId, correlationId: context.correlationId, outcome: "SUCCESS", origin: "admin-user-management", metadata: { action: accessRequest.action, approvedUserId, isMaster: draft.isMaster, isOwner: draft.isOwner } } });
      });

      const teamsProvisioning = draft.status === "ACTIVE"
        ? await provisionTeamsAppForManagedUser({ userId: approvedUserId, email: draft.email, actorId: authorization.actorId, correlationId: context.correlationId })
        : null;
      revalidatePath("/admin");
      return NextResponse.json({ data: { id: requestId, status: "APPROVED", userId: approvedUserId, teamsProvisioning }, correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
