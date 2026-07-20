import { z } from "zod";

export const complianceMatrixSchema = z.object({
  tenderVersionId: z.uuid(),
  analysisReference: z.string().trim().min(3).max(160),
}).strict();

export type ComplianceMatrixDraft = z.infer<typeof complianceMatrixSchema>;

