import { z } from "zod";

const professionalLinkSchema = z.object({
  targetType: z.enum(["CONTRACT", "WORK", "TECHNICAL_EVIDENCE"]),
  targetId: z.uuid(),
  role: z.string().trim().min(1).max(160),
  responsibility: z.string().trim().min(1).max(5000),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date(),
  source: z.string().trim().min(1).max(500),
  evidenceDocumentVersionId: z.uuid(),
}).strict().refine(value => value.endedAt >= value.startedAt, { path: ["endedAt"], message: "O fim do vínculo não pode anteceder o início." });

export const professionalSchema = z.object({
  fullName: z.string().trim().min(3).max(255),
  council: z.string().trim().min(2).max(40).toUpperCase(),
  registrationNumber: z.string().trim().min(1).max(100),
  nationalRegistration: z.string().trim().min(1).max(100).optional(),
  professionalTitle: z.string().trim().min(2).max(160),
  status: z.enum(["ACTIVE", "INACTIVE", "RESTRICTED"]).default("ACTIVE"),
  processingPurpose: z.string().trim().min(10).max(500),
  legalBasis: z.string().trim().min(3).max(255),
  links: z.array(professionalLinkSchema).min(1).max(50),
}).strict();

export type ProfessionalDraft = z.infer<typeof professionalSchema>;
