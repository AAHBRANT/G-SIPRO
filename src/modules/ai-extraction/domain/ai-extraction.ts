import { z } from "zod";

const shortText = (max: number) => z.string().trim().min(1).max(max);

export const aiExtractionRequestSchema = z.object({
  idempotencyKey: shortText(120),
  definitionId: z.uuid(),
  documentVersionId: z.uuid(),
  requestedFields: z.array(shortText(200)).min(1).max(50).transform((items) => [...new Set(items)]),
  instructions: z.string().trim().max(4_000).optional(),
});

export const aiExtractionResultSchema = z.object({
  content: z.array(z.object({ field: shortText(200), value: z.string().trim().max(120_000) })).min(1).max(100),
  confidence: z.number().min(0).max(1),
  limitations: z.array(shortText(1_000)).max(50),
  evidence: z.array(z.object({ excerpt: shortText(4_000), locator: shortText(500) })).min(1).max(100),
});

export type AiExtractionRequest = z.infer<typeof aiExtractionRequestSchema>;
export type AiExtractionResult = z.infer<typeof aiExtractionResultSchema>;

export type AiExtractionProviderInput = Readonly<{
  model: string;
  prompt: string;
  documentTitle: string;
  documentType: string;
  fileHash: string;
  mimeType: string;
  bytes: Buffer;
  requestedFields: string[];
  instructions?: string;
  correlationId: string;
}>;

export type AiExtractionProviderOutput = Readonly<{
  providerResponseId: string;
  result: AiExtractionResult;
}>;

export interface AiExtractionProvider {
  execute(input: AiExtractionProviderInput): Promise<AiExtractionProviderOutput>;
}

export class AiExtractionRuleError extends Error {}
export class AiExtractionProviderError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}
