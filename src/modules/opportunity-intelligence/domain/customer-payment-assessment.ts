import { createHash } from "node:crypto";

import { z } from "zod";

const dateSchema = z.iso.date();
const evidenceSchema = z.object({
  sourceType: z.string().trim().min(2).max(80),
  sourceReference: z.string().trim().min(2).max(500),
  sourceDate: dateSchema,
  documentHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
}).strict();

export const customerPaymentAssessmentDraftSchema = z.object({
  customerId: z.uuid().optional(),
  authorityId: z.uuid().optional(),
  periodStart: dateSchema,
  periodEnd: dateSchema,
  classification: z.enum(["GOOD_PAYER", "ATTENTION", "NON_PAYER", "INSUFFICIENT_DATA"]),
  authorizedMetrics: z.object({
    invoiceCount: z.number().int().nonnegative().optional(),
    overdueCount: z.number().int().nonnegative().optional(),
    averageDelayDays: z.number().nonnegative().optional(),
    overdueAmount: z.number().nonnegative().optional(),
    currency: z.string().length(3).transform(value => value.toUpperCase()).optional(),
    renegotiations: z.number().int().nonnegative().optional(),
    disputes: z.number().int().nonnegative().optional(),
  }).strict(),
  justification: z.string().trim().min(20).max(5000),
  evidence: evidenceSchema.array().min(1).max(100),
  confirmedAt: z.iso.datetime({ offset: true }),
}).strict().superRefine((value, context) => {
  if ((value.customerId ? 1 : 0) + (value.authorityId ? 1 : 0) !== 1) {
    context.addIssue({
      code: "custom",
      path: ["customerId"],
      message: "Informe exatamente um cliente ou órgão contratante.",
    });
  }
  if (value.periodEnd < value.periodStart) {
    context.addIssue({ code: "custom", path: ["periodEnd"], message: "O fim do período deve ser posterior ao início." });
  }
}).transform(value => ({
  ...value,
  subjectKey: value.customerId ? `CUSTOMER:${value.customerId}` : `AUTHORITY:${value.authorityId}`,
}));

export type CustomerPaymentAssessmentDraft = z.output<typeof customerPaymentAssessmentDraftSchema>;

export function calculateCustomerPaymentAssessment(draft: CustomerPaymentAssessmentDraft) {
  const nonPayingCustomer = draft.classification === "NON_PAYER";
  const snapshot = { ...draft, nonPayingCustomer };
  return {
    ...snapshot,
    assessmentHash: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
  };
}
