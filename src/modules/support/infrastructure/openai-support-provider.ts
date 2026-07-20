import { supportDiagnosisSchema, type SupportDiagnosis, type SupportTicketInput } from "../domain/support-ticket";

export class OpenAiSupportProvider {
  constructor(
    private readonly apiKey = process.env.OPENAI_API_KEY?.trim(),
    private readonly model = "gpt-5.6-sol",
    private readonly timeoutMs = Number(process.env.OPENAI_REQUEST_TIMEOUT_MS) || 120_000,
  ) {}

  async diagnose(input: SupportTicketInput, correlationId: string): Promise<SupportDiagnosis> {
    if (!this.apiKey) throw new Error("OPENAI_NOT_CONFIGURED");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(Math.max(this.timeoutMs, 5_000), 300_000));
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json", "X-Client-Request-Id": correlationId },
        body: JSON.stringify({
          model: this.model,
          store: false,
          input: [
            { role: "system", content: "Você faz triagem técnica do G-SIPRO. Analise somente as evidências fornecidas. Não afirme que uma correção foi executada. Diferencie CORRECTION (restaurar comportamento esperado) de CONFIGURATION, FUNCTIONAL_CHANGE e NEW_TOOL. Mudanças funcionais e novas ferramentas exigem aprovação humana." },
            { role: "user", content: `Tipo: ${input.type}\nPrioridade informada: ${input.priority}\nTítulo: ${input.title}\nDescrição: ${input.description}\nTela: ${input.pagePath || "não informada"}\nErro: ${input.errorMessage || "não informado"}\nPassos: ${input.stepsToReproduce || "não informados"}\nContexto técnico: ${JSON.stringify(input.clientContext || {})}` },
          ],
          text: { format: { type: "json_schema", name: "gsipro_support_triage", strict: true, schema: {
            type: "object", additionalProperties: false,
            required: ["summary", "probableCause", "severity", "changeClass", "recommendedAction", "suggestedTests", "userGuidance", "confidence"],
            properties: {
              summary: { type: "string" }, probableCause: { type: "string" },
              severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
              changeClass: { type: "string", enum: ["CORRECTION", "CONFIGURATION", "FUNCTIONAL_CHANGE", "NEW_TOOL"] },
              recommendedAction: { type: "string" }, suggestedTests: { type: "array", items: { type: "string" } },
              userGuidance: { type: "string" }, confidence: { type: "number", minimum: 0, maximum: 1 },
            },
          }}},
          max_output_tokens: 2_500,
        }),
      });
      const payload = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(`OPENAI_HTTP_${response.status}`);
      const output = Array.isArray(payload.output) ? payload.output : [];
      const text = output.flatMap(item => typeof item === "object" && item && Array.isArray((item as { content?: unknown[] }).content) ? (item as { content: unknown[] }).content : [])
        .find(item => typeof item === "object" && item && (item as { type?: string }).type === "output_text") as { text?: string } | undefined;
      if (!text?.text) throw new Error("OPENAI_EMPTY_OUTPUT");
      return supportDiagnosisSchema.parse(JSON.parse(text.text));
    } finally {
      clearTimeout(timeout);
    }
  }

  get modelName() { return this.model; }
}
