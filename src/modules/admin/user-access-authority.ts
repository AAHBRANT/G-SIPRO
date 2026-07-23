export type UserAccessAuthorityInput = Readonly<{
  actorIsOwner: boolean;
  requestedIsMaster: boolean;
  requestedIsOwner: boolean;
  currentIsMaster?: boolean;
  currentIsOwner?: boolean;
}>;

export type UserAccessDisposition = "DIRECT" | "OWNER_APPROVAL" | "FORBIDDEN";

export function userAccessDisposition(input: UserAccessAuthorityInput): UserAccessDisposition {
  if (input.actorIsOwner) return "DIRECT";
  if (input.requestedIsOwner) return "FORBIDDEN";
  if (input.currentIsOwner) return "FORBIDDEN";
  if (input.requestedIsMaster || input.currentIsMaster) return "OWNER_APPROVAL";
  return "DIRECT";
}
