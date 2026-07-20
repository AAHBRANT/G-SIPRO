import { z } from "zod";

export const opportunityOrigins = ["CHANNEL", "REFERRAL", "PORTAL", "CUSTOMER", "PROSPECTING"] as const;
export const opportunityStatuses = ["DRAFT", "QUALIFICATION", "ACTIVE", "SUSPENDED", "CLOSED"] as const;

export type OpportunityOrigin = (typeof opportunityOrigins)[number];
export type OpportunityStatus = (typeof opportunityStatuses)[number];

const opportunityDraftBaseSchema = z.object({
    code: z.string().trim().min(1).max(50),
    origin: z.enum(opportunityOrigins),
    subject: z.string().trim().min(1).max(10_000).optional(),
    customerId: z.uuid().optional(),
    contractingAuthorityId: z.uuid().optional(),
    estimatedValue: z.coerce.number().nonnegative().optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    valueSource: z.string().trim().min(1).max(300).optional(),
    publishedAt: z.coerce.date().optional(),
    deliveryAt: z.coerce.date().optional(),
    datesSource: z.string().trim().min(1).max(300).optional(),
    datesTimeZone: z.string().trim().min(1).max(80).optional(),
    ownerId: z.uuid().optional(),
  });

export const opportunityPatchSchema = opportunityDraftBaseSchema.partial();

export const opportunityDraftSchema = opportunityDraftBaseSchema
  .superRefine((value, context) => {
    if (value.estimatedValue !== undefined && (!value.currency || !value.valueSource)) {
      context.addIssue({ code: "custom", path: ["estimatedValue"], message: "Moeda e fonte são obrigatórias para o valor estimado." });
    }
    if ((value.publishedAt || value.deliveryAt) && (!value.datesSource || !value.datesTimeZone)) {
      context.addIssue({ code: "custom", path: ["datesSource"], message: "Fonte e fuso são obrigatórios para datas informadas." });
    }
  });

export type OpportunityDraft = z.infer<typeof opportunityDraftSchema>;
export type OpportunityPatch = z.infer<typeof opportunityPatchSchema>;

export type OpportunityLifecycleSnapshot = Readonly<
  OpportunityDraft & {
    status: OpportunityStatus;
  }
>;

const allowedTransitions: Readonly<Record<OpportunityStatus, ReadonlySet<OpportunityStatus>>> = {
  DRAFT: new Set(["QUALIFICATION"]),
  QUALIFICATION: new Set(["ACTIVE", "SUSPENDED", "CLOSED"]),
  ACTIVE: new Set(["SUSPENDED", "CLOSED"]),
  SUSPENDED: new Set(["ACTIVE", "CLOSED"]),
  CLOSED: new Set(["QUALIFICATION"]),
};

export class OpportunityRuleError extends Error {
  constructor(
    message: string,
    readonly fields: readonly string[],
  ) {
    super(message);
    this.name = "OpportunityRuleError";
  }
}

export function validateActivation(snapshot: OpportunityLifecycleSnapshot): void {
  const missing = [
    !snapshot.subject && "subject",
    !snapshot.ownerId && "ownerId",
    snapshot.estimatedValue !== undefined && !snapshot.currency && "currency",
    snapshot.estimatedValue !== undefined && !snapshot.valueSource && "valueSource",
    (snapshot.publishedAt || snapshot.deliveryAt) && !snapshot.datesSource && "datesSource",
    (snapshot.publishedAt || snapshot.deliveryAt) && !snapshot.datesTimeZone && "datesTimeZone",
  ].filter((field): field is string => Boolean(field));

  if (missing.length > 0) {
    throw new OpportunityRuleError("A oportunidade não possui os dados mínimos para ativação.", missing);
  }
}

export function assertOpportunityTransition(
  snapshot: OpportunityLifecycleSnapshot,
  target: OpportunityStatus,
  closureReasonCode?: string,
  transitionReason?: string,
): void {
  if (!allowedTransitions[snapshot.status].has(target)) {
    throw new OpportunityRuleError("Transição de oportunidade não permitida.", ["status"]);
  }
  if (target === "ACTIVE") validateActivation(snapshot);
  if (target === "CLOSED" && !closureReasonCode?.trim()) {
    throw new OpportunityRuleError("O encerramento exige motivo padronizado.", ["closureReasonCode"]);
  }
  if (snapshot.status === "CLOSED" && target === "QUALIFICATION" && !transitionReason?.trim()) {
    throw new OpportunityRuleError("A reabertura exige justificativa.", ["transitionReason"]);
  }
}

const criticalFields = ["subject", "estimatedValue", "currency", "deliveryAt", "ownerId", "status"] as const;

export function collectCriticalChanges(
  before: Readonly<Record<string, unknown>>,
  after: Readonly<Record<string, unknown>>,
): Readonly<Record<string, Readonly<{ from: unknown; to: unknown }>>> {
  return Object.fromEntries(
    criticalFields
      .filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
      .map((field) => [field, Object.freeze({ from: before[field] ?? null, to: after[field] ?? null })]),
  );
}
