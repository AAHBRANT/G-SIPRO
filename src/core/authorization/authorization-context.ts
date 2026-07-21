import { auth } from "@/auth";
import { getDatabase } from "@/core/database/prisma";
import { AuthorizationError } from "@/core/errors/application-error";
import { authorize, type AuthorizationContext } from "@/core/authorization/policy";

export async function getCurrentAuthorizationContext(): Promise<AuthorizationContext | undefined> {
  const session = await auth();
  const entraObjectId = session?.user?.entraObjectId;
  if (!entraObjectId) return undefined;

  const now = new Date();
  const user = await getDatabase().user.findUnique({
    where: { entraObjectId },
    include: {
      profileMemberships: {
        where: {
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gt: now } }],
          profile: { active: true },
        },
        include: {
          profile: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });

  if (!user || user.status !== "ACTIVE") return undefined;
  const permissions = new Set(
    user.profileMemberships.flatMap(({ profile }) => profile.permissions.map(({ permission }) => permission.code)),
  );
  return { actorId: user.id, permissions, isMaster: user.isMaster, isOwner: user.isOwner };
}

export async function requireMaster(): Promise<AuthorizationContext> {
  const context = await getCurrentAuthorizationContext();
  if (!context?.isMaster) throw new AuthorizationError("Acesso exclusivo de usuário mestre.", { reason: "MASTER_REQUIRED" });
  return context;
}

export async function requireOwner(): Promise<AuthorizationContext> {
  const context = await getCurrentAuthorizationContext();
  if (!context?.isOwner) throw new AuthorizationError("Aprovação exclusiva do proprietário do G-SIPRO.", { reason: "OWNER_REQUIRED" });
  return context;
}

export async function requirePermission(permission: string): Promise<AuthorizationContext> {
  const context = await getCurrentAuthorizationContext();
  if (!context) throw new AuthorizationError("Acesso não provisionado para esta operação.", { reason: "NO_CONTEXT" });
  const decision = authorize(context, { permission });
  if (!decision.allowed) throw new AuthorizationError("Acesso não provisionado para esta operação.", { reason: decision.reason });
  return context;
}
