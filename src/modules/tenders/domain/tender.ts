import { z } from "zod";

export const sha256Schema = z.string().trim().toLowerCase().regex(/^[a-f0-9]{64}$/, "Hash SHA-256 inválido.");

export const tenderSchema = z.object({
  code: z.string().trim().min(1).max(50),
  number: z.string().trim().min(1).max(100),
  modality: z.string().trim().min(1).max(100),
  subject: z.string().trim().min(1).max(10_000),
  origin: z.string().trim().min(1).max(500),
  opportunityId: z.uuid().optional(),
  contractingAuthorityId: z.uuid().optional(),
  lots: z.array(z.object({ code: z.string().trim().min(1).max(80), subject: z.string().trim().min(1).max(10_000) })).max(500).default([]),
});

export const tenderVersionSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileHash: sha256Schema,
  uri: z.url().max(1000),
  mimeType: z.string().trim().min(1).max(160),
  sizeBytes: z.coerce.bigint().positive(),
  source: z.string().trim().min(1).max(500),
  receivedAt: z.coerce.date(),
  attachments: z.array(z.object({ fileName: z.string().trim().min(1).max(255), fileHash: sha256Schema, source: z.string().trim().min(1).max(500) })).max(1000).default([]),
});

export type TenderDraft = z.infer<typeof tenderSchema>;
export type TenderVersionDraft = z.infer<typeof tenderVersionSchema>;
