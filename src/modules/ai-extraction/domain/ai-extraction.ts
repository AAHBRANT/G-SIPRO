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

/**
 * Pedido de extração sobre fonte EFÊMERA: bytes que o sistema buscou, leu e
 * descartou, sem preservar o arquivo.
 *
 * ⚠️ Este esquema NÃO é exposto na rota pública `/api/ai-extractions`, e não
 * deve passar a ser. Dois motivos, os dois graves:
 *
 * 1. `source.uri` mandaria o servidor buscar um endereço escolhido por quem
 *    chama — é requisição forjada do lado do servidor, com a rede interna ao
 *    alcance.
 * 2. `source.documentType` é o que a governança usa para casar o caso de uso
 *    autorizado. Declarado pelo cliente, bastaria dizer "ATESTADO" para rodar
 *    sob um caso de uso aprovado para outra coisa.
 *
 * No caminho efêmero os dois vêm de código nosso: o tipo é constante, e a URL
 * sai da listagem de arquivos que o próprio PNCP publica para aquela licitação.
 */
export const ephemeralExtractionRequestSchema = z.object({
  idempotencyKey: shortText(120),
  definitionId: z.uuid(),
  requestedFields: z.array(shortText(200)).min(1).max(50).transform((items) => [...new Set(items)]),
  instructions: z.string().trim().max(4_000).optional(),
  source: z.object({
    uri: z.url().max(1_000),
    filename: shortText(255),
    // Deduzido pelo chamador a partir do nome real do arquivo. Não é fronteira
    // de segurança: a lista branca do provedor recusa o que ele não sabe ler.
    mimeType: shortText(160),
    documentType: shortText(160),
    title: shortText(255),
  }),
});

/**
 * Procedência dos bytes que o modelo leu.
 *
 * `ARCHIVED` é a de sempre: arquivo preservado no acervo, cujo hash o banco
 * confere contra a linha. `EPHEMERAL` é o arquivo público que não vale a pena
 * guardar — o que prova o que foi lido passa a ser o SHA-256 dos bytes, mais o
 * endereço e a data da captura.
 */
export type ExtractionSource =
  | Readonly<{
    kind: "ARCHIVED";
    documentVersionId: string;
    documentType: string;
    title: string;
    fileHash: string;
    mimeType: string;
  }>
  | Readonly<{
    kind: "EPHEMERAL";
    uri: string;
    filename: string;
    documentType: string;
    title: string;
    fileHash: string;
    mimeType: string;
    sizeBytes: number;
    fetchedAt: Date;
  }>;

export type AiExtractionRequest = z.infer<typeof aiExtractionRequestSchema>;
export type EphemeralExtractionRequest = z.infer<typeof ephemeralExtractionRequestSchema>;
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
