import { z } from "zod";
export const documentSchema = z.object({ type: z.string().trim().min(1).max(80), title: z.string().trim().min(1).max(255), classification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL_COMMERCIAL", "CONFIDENTIAL_TECHNICAL", "PERSONAL_DATA", "AUDIT"]), status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"), ownerId: z.uuid() });
export const documentVersionSchema = z.object({ uri: z.url().max(1000), fileHash: z.string().regex(/^[a-f0-9]{64}$/), mimeType: z.string().trim().min(1).max(160), sizeBytes: z.coerce.bigint().positive(), origin: z.string().trim().min(1).max(500) });
export const documentLinkSchema = z.object({ entityType: z.string().trim().min(1).max(80), entityId: z.string().trim().min(1).max(160), role: z.string().trim().min(1).max(80) });
export type DocumentDraft = z.infer<typeof documentSchema>; export type DocumentVersionDraft = z.infer<typeof documentVersionSchema>; export type DocumentLinkDraft = z.infer<typeof documentLinkSchema>;
