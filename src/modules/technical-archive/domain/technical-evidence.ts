import { z } from "zod";

export const technicalEvidenceSchema = z
  .object({
    experienceId: z.uuid(),
    type: z.enum(["ATTESTATION", "CAT", "ART"]),
    number: z.string().trim().min(1).max(100),
    issuingBody: z.string().trim().min(1).max(255),
    issuedAt: z.coerce.date(),
    validUntil: z.coerce.date().optional(),
    status: z.enum(["CURRENT", "RESTRICTED", "EXPIRED"]).default("CURRENT"),
    subjectActivity: z.string().trim().min(1).max(5000),
    professionalName: z.string().trim().min(1).max(255).optional(),
    professionalIdentifier: z.string().trim().min(1).max(100).optional(),
    startedAt: z.coerce.date().optional(),
    endedAt: z.coerce.date().optional(),
    restrictions: z.string().trim().max(5000).optional(),
    documentVersionId: z.uuid(),
    previousVersionId: z.uuid().optional(),
    relatedCatId: z.uuid().optional(),
  })
  .superRefine((value, context) => {
    if (value.validUntil && value.validUntil < value.issuedAt) {
      context.addIssue({ code: "custom", path: ["validUntil"], message: "A validade não pode anteceder a emissão." });
    }
    if ((value.startedAt === undefined) !== (value.endedAt === undefined)) {
      context.addIssue({ code: "custom", path: ["endedAt"], message: "O período deve ter início e fim." });
    }
    if (value.startedAt && value.endedAt && value.endedAt < value.startedAt) {
      context.addIssue({ code: "custom", path: ["endedAt"], message: "O fim não pode anteceder o início." });
    }
    if (value.type !== "ATTESTATION" && (!value.professionalName || !value.startedAt)) {
      context.addIssue({ code: "custom", path: ["professionalName"], message: "CAT e ART exigem profissional e período." });
    }
    if (value.type !== "ART" && value.relatedCatId) {
      context.addIssue({ code: "custom", path: ["relatedCatId"], message: "Somente uma ART pode apontar para uma CAT." });
    }
  });

export type TechnicalEvidenceDraft = z.infer<typeof technicalEvidenceSchema>;
