export type AuthorizationContext = Readonly<{
  actorId: string;
  permissions: ReadonlySet<string>;
  isMaster?: boolean;
  isOwner?: boolean;
  scopes?: ReadonlySet<string>;
}>;

export type AuthorizationRequirement = Readonly<{
  permission: string;
  scope?: string;
}>;

export type AuthorizationDecision = Readonly<{
  allowed: boolean;
  reason: "GRANTED" | "MISSING_PERMISSION" | "MISSING_SCOPE" | "NO_CONTEXT";
}>;

export function authorize(
  context: AuthorizationContext | undefined,
  requirement: AuthorizationRequirement,
): AuthorizationDecision {
  if (!context) return { allowed: false, reason: "NO_CONTEXT" };
  if (context.isOwner || context.isMaster) return { allowed: true, reason: "GRANTED" };
  if (!context.permissions.has(requirement.permission)) {
    return { allowed: false, reason: "MISSING_PERMISSION" };
  }
  if (requirement.scope && !context.scopes?.has(requirement.scope)) {
    return { allowed: false, reason: "MISSING_SCOPE" };
  }
  return { allowed: true, reason: "GRANTED" };
}
