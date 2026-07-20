import { z } from "zod";

const date = z.iso.date();
const source = z.string().trim().min(3).max(500);
export const factStatusSchema = z.enum(["ESTIMATED", "CONFIRMED"]);

export const competitionSchema = z.object({
  tenderId: z.uuid(), tenderLotId: z.uuid(), competitionDate: date,
  sourceReference: source, sourceDate: date,
});

export const participantSchema = z.object({
  legalName: z.string().trim().min(2).max(300), tradeName: z.string().trim().max(300).optional(),
  knownNames: z.array(z.string().trim().min(2).max(300)).max(20).default([]),
  status: z.enum(["EXPECTED", "PARTICIPATING", "WITHDRAWN"]), factStatus: factStatusSchema,
  sourceReference: source, sourceDate: date,
});

export const offerSchema = z.object({
  previousOfferId: z.uuid().optional(), amount: z.string().regex(/^\d{1,15}(\.\d{1,4})?$/),
  currency: z.string().trim().length(3).transform(value => value.toUpperCase()), offerDate: date,
  factStatus: factStatusSchema, sourceReference: source, sourceDate: date,
});

export const competitionActSchema = z.object({
  previousActId: z.uuid().optional(), participantId: z.uuid().optional(),
  type: z.enum(["JUDGMENT", "DILIGENCE", "APPEAL", "COUNTERARGUMENT", "DECISION"]),
  summary: z.string().trim().min(3).max(10_000),
  judgmentClassification: z.string().trim().min(1).max(200).optional(),
  qualification: z.string().trim().min(1).max(200).optional(), criterion: z.string().trim().min(1).max(1000).optional(),
  actDate: date, deadlineAt: z.iso.datetime({ offset: true }).optional(), documentVersionId: z.uuid(),
  sourceReference: source, sourceDate: date,
}).superRefine((act, context) => {
  if (act.type === "JUDGMENT") {
    if (!act.participantId) context.addIssue({ code: "custom", path: ["participantId"], message: "Julgamento exige participante." });
    if (!act.judgmentClassification) context.addIssue({ code: "custom", path: ["judgmentClassification"], message: "Informe a classificação." });
    if (!act.qualification) context.addIssue({ code: "custom", path: ["qualification"], message: "Informe a habilitação." });
    if (!act.criterion) context.addIssue({ code: "custom", path: ["criterion"], message: "Informe o critério." });
  }
  if (["DILIGENCE", "APPEAL", "COUNTERARGUMENT"].includes(act.type) && !act.deadlineAt) context.addIssue({ code: "custom", path: ["deadlineAt"], message: "Este tipo de ato exige prazo." });
});

export const competitionOutcomeSchema = z.enum(["WIN", "LOSS", "DISQUALIFICATION", "CANCELLATION"]);
export const motiveCategorySchema = z.object({
  previousCategoryId: z.uuid().optional(), code: z.string().trim().min(2).max(80).transform(value=>value.toUpperCase()),
  name: z.string().trim().min(2).max(200), definition: z.string().trim().min(3).max(1000),
  applicableOutcome: competitionOutcomeSchema.optional(), status: z.enum(["ACTIVE", "INACTIVE"]),
  changeReason: z.string().trim().min(3).max(1000), sourceReference: source, sourceDate: date,
});
export const competitionResultSchema = z.object({
  previousResultId: z.uuid().optional(), outcome: competitionOutcomeSchema, winningParticipantId: z.uuid().optional(),
  motiveCategoryId: z.uuid(), justification: z.string().trim().min(3).max(10_000), resultDate: date,
  documentVersionId: z.uuid(), sourceReference: source, sourceDate: date,
});
export const resultValidationSchema = z.object({note:z.string().trim().min(3).max(1000)});
export const competitionAwardSchema = z.object({contractValue:z.string().regex(/^\d{1,15}(\.\d{1,4})?$/),currency:z.string().trim().length(3).transform(value=>value.toUpperCase()),documentVersionId:z.uuid(),sourceReference:source,sourceDate:date});

export type CompetitionDraft=z.infer<typeof competitionSchema>;
export type ParticipantDraft=z.infer<typeof participantSchema>;
export type OfferDraft=z.infer<typeof offerSchema>;
export type CompetitionActDraft=z.infer<typeof competitionActSchema>;
export type MotiveCategoryDraft=z.infer<typeof motiveCategorySchema>;
export type CompetitionResultDraft=z.infer<typeof competitionResultSchema>;
export type ResultValidationDraft=z.infer<typeof resultValidationSchema>;
export type CompetitionAwardDraft=z.infer<typeof competitionAwardSchema>;
