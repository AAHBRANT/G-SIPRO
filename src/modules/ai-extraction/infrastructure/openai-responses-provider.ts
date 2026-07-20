import { aiExtractionResultSchema, AiExtractionProviderError, type AiExtractionProvider, type AiExtractionProviderInput } from "../domain/ai-extraction";

const acceptedMimeTypes = new Set([
  "application/pdf", "text/plain", "text/markdown", "text/csv", "application/csv", "application/json", "text/html", "application/xml", "text/xml",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const extensionByMime: Record<string, string> = {"application/pdf":"pdf","text/plain":"txt","text/markdown":"md","text/csv":"csv","application/csv":"csv","application/json":"json","text/html":"html","application/xml":"xml","text/xml":"xml","application/msword":"doc","application/vnd.openxmlformats-officedocument.wordprocessingml.document":"docx","application/vnd.ms-excel":"xls","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"xlsx","application/vnd.ms-powerpoint":"ppt","application/vnd.openxmlformats-officedocument.presentationml.presentation":"pptx"};

export class OpenAiResponsesProvider implements AiExtractionProvider {
  constructor(
    private readonly apiKey = process.env.OPENAI_API_KEY?.trim(),
    private readonly timeoutMs = Number(process.env.OPENAI_REQUEST_TIMEOUT_MS) || 300_000,
    private readonly maxOutputTokens = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS) || 32_000,
  ) {}

  async execute(input: AiExtractionProviderInput) {
    if (!this.apiKey) throw new AiExtractionProviderError("OPENAI_NOT_CONFIGURED", "A chave da OpenAI ainda não foi configurada no servidor.");
    if (!acceptedMimeTypes.has(input.mimeType)) throw new AiExtractionProviderError("UNSUPPORTED_DOCUMENT_TYPE", `Formato ${input.mimeType} não habilitado para extração assistida.`);
    const extension = extensionByMime[input.mimeType] ?? "bin";
    const filename = `${input.documentTitle.replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 80) || "documento"}.${extension}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(Math.max(this.timeoutMs, 5_000), 300_000));
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json", "X-Client-Request-Id": input.correlationId },
        body: JSON.stringify({
          model: input.model,
          store: false,
          input: [
            { role: "system", content: `${input.prompt}\n\nCONTROLES OBRIGATÓRIOS: responda somente com dados sustentados pela fonte; não aprove, decida ou substitua validação humana; informe limitações; associe cada resultado a trecho e localizador verificáveis.` },
            { role: "user", content: [
              { type: "input_file", filename, file_data: `data:${input.mimeType};base64,${input.bytes.toString("base64")}` },
              { type: "input_text", text: `Documento: ${input.documentTitle}\nTipo controlado: ${input.documentType}\nSHA-256: ${input.fileHash}\nCampos solicitados: ${input.requestedFields.join(", ")}\nInstruções adicionais: ${input.instructions || "nenhuma"}\nA saída é assistiva e deverá ser validada por uma pessoa.` },
            ]},
          ],
          text: { format: { type: "json_schema", name: "gsipro_document_extraction", strict: true, schema: {
            type: "object", additionalProperties: false, required: ["content","confidence","limitations","evidence"], properties: {
              content: { type: "array", minItems: 1, items: { type: "object", additionalProperties: false, required: ["field","value"], properties: { field: {type:"string"}, value: {type:"string"} } } },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              limitations: { type: "array", items: {type:"string"} },
              evidence: { type: "array", minItems: 1, items: { type: "object", additionalProperties: false, required: ["excerpt","locator"], properties: { excerpt: {type:"string"}, locator: {type:"string"} } } },
            },
          }}},
          max_output_tokens: Math.min(Math.max(this.maxOutputTokens, 8_000), 128_000),
        }),
      });
      const payload = await response.json() as Record<string, unknown>;
      if (!response.ok) {
        const error = payload.error as { code?: string; message?: string } | undefined;
        throw new AiExtractionProviderError(String(error?.code || `OPENAI_HTTP_${response.status}`).slice(0,120), String(error?.message || "A OpenAI não concluiu a solicitação.").slice(0,500));
      }
      if (payload.status === "incomplete") {
        const details = payload.incomplete_details as { reason?: string } | undefined;
        const reason = details?.reason === "max_output_tokens" ? "A resposta atingiu o limite de tamanho configurado." : "A OpenAI devolveu uma resposta incompleta.";
        throw new AiExtractionProviderError("OPENAI_OUTPUT_INCOMPLETE", reason);
      }
      const output = Array.isArray(payload.output) ? payload.output : [];
      const text = output.flatMap((item) => typeof item === "object" && item && Array.isArray((item as {content?:unknown[]}).content) ? (item as {content:unknown[]}).content : [])
        .find((item) => typeof item === "object" && item && (item as {type?:string}).type === "output_text") as {text?:string} | undefined;
      if (!text?.text) throw new AiExtractionProviderError("OPENAI_EMPTY_OUTPUT", "A OpenAI não retornou conteúdo estruturado utilizável.");
      let parsed: unknown;
      try {
        parsed = JSON.parse(text.text);
      } catch {
        throw new AiExtractionProviderError("OPENAI_OUTPUT_INVALID_JSON", "A resposta estruturada foi interrompida ou ficou inválida. Tente novamente.");
      }
      return { providerResponseId: String(payload.id || "").slice(0,200), result: aiExtractionResultSchema.parse(parsed) };
    } catch (error) {
      if (error instanceof AiExtractionProviderError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") throw new AiExtractionProviderError("OPENAI_TIMEOUT", "A extração excedeu o tempo limite configurado.");
      throw new AiExtractionProviderError("OPENAI_REQUEST_FAILED", error instanceof Error ? error.message.slice(0,500) : "Falha de comunicação com a OpenAI.");
    } finally { clearTimeout(timeout); }
  }
}
