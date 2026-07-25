import { z } from "zod";

export const operationalBaseSchema = z.object({
  code: z.string().trim().min(2).max(50).transform(value => value.toUpperCase()),
  name: z.string().trim().min(2).max(200),
  locality: z.string().trim().min(2).max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  source: z.string().trim().min(2).max(500),
}).strict();

export type OperationalBaseDraft = z.infer<typeof operationalBaseSchema>;
