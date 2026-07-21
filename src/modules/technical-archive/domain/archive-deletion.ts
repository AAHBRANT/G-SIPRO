import { z } from "zod";

export const archiveDeletionSchema = z.object({
  reason: z.string().trim().min(5, "Informe o motivo da exclusão.").max(1000),
});
