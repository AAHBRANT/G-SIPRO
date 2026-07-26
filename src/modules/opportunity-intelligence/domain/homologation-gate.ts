export const homologationAreas = [
  "SECURITY",
  "FUNCTIONAL",
  "PERFORMANCE",
  "RESILIENCE",
  "COST",
  "ACCESSIBILITY",
  "EXTERNAL_INTEGRATIONS",
  "AUTHORIZED_REAL_SCENARIOS",
] as const;

export type HomologationArea = (typeof homologationAreas)[number];
export type HomologationCheckStatus = "PASS" | "FAIL" | "BLOCKED";
export type HomologationGateStatus =
  | "APPROVED"
  | "REJECTED"
  | "BLOCKED"
  | "WAITING_OWNER_APPROVAL";

export type HomologationCheck = Readonly<{
  area: HomologationArea;
  status: HomologationCheckStatus;
  evidence: string;
}>;

export type HomologationGate = Readonly<{
  status: HomologationGateStatus;
  failedAreas: readonly HomologationArea[];
  blockedAreas: readonly HomologationArea[];
  ownerApproval: boolean;
}>;

export function evaluateHomologationGate(input: Readonly<{
  checks: readonly HomologationCheck[];
  ownerApproval: boolean;
}>): HomologationGate {
  const checksByArea = new Map(input.checks.map((check) => [check.area, check]));
  const missingAreas = homologationAreas.filter((area) => !checksByArea.has(area));
  const failedAreas = homologationAreas.filter(
    (area) => checksByArea.get(area)?.status === "FAIL",
  );
  const blockedAreas = homologationAreas.filter(
    (area) =>
      missingAreas.includes(area) ||
      checksByArea.get(area)?.status === "BLOCKED",
  );

  let status: HomologationGateStatus;
  if (failedAreas.length > 0) status = "REJECTED";
  else if (blockedAreas.length > 0) status = "BLOCKED";
  else if (!input.ownerApproval) status = "WAITING_OWNER_APPROVAL";
  else status = "APPROVED";

  return {
    status,
    failedAreas,
    blockedAreas,
    ownerApproval: input.ownerApproval,
  };
}
