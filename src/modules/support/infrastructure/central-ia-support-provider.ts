import { supportClarificationSchema, supportDiagnosisSchema, type SupportClarification, type SupportDiagnosis, type SupportTicketInput } from "../domain/support-ticket";

/** Limite de cada requisição individual. Curto de propósito: nenhuma chamada
 *  espera a inferência, só cria o trabalho ou consulta o status. */
const REQUEST_TIMEOUT_MS = 30_000;

/** Intervalo entre consultas. Equilibra latência de detecção e volume de
 *  requisições no túnel, cujo plano gratuito tem limite de uso. */
const POLL_INTERVAL_MS = 5_000;

const triageResponseFormat = {
  type: "object", additionalProperties: false,
  required: ["summary", "probableCause", "severity", "changeClass", "requiredActor", "ownerActionCategory", "requiredAction", "securityGuidance", "recommendedAction", "suggestedTests", "userGuidance", "confidence"],
  properties: {
    summary: { type: "string" }, probableCause: { type: "string" },
    severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
    changeClass: { type: "string", enum: ["CORRECTION", "CONFIGURATION", "FUNCTIONAL_CHANGE", "NEW_TOOL"] },
    requiredActor: { type: "string", enum: ["AI", "MASTER", "OWNER", "REQUESTER"] },
    ownerActionCategory: { anyOf: [{ type: "string", enum: ["MICROSOFT_365", "TEAMS", "AZURE", "IDENTITY_ACCESS", "SECURITY", "EXTERNAL_SERVICE", "OTHER"] }, { type: "null" }] },
    requiredAction: { anyOf: [{ type: "string" }, { type: "null" }] },
    securityGuidance: { anyOf: [{ type: "string" }, { type: "null" }] },
    recommendedAction: { type: "string" },
    // O limite é deliberadamente mais apertado que o `.max(12)` do Zod: um array
    // sem teto é um convite à fuga de geração, porque nada obriga o modelo a
    // fechá-lo. Triagens saudáveis produzem 3 itens; 5 já é folga.
    suggestedTests: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
    userGuidance: { type: "string" }, confidence: { type: "number", minimum: 0, maximum: 1 },
  },
} as const;

const clarificationResponseFormat = {
  type: "object", additionalProperties: false,
  required: ["introduction", "questions"],
  properties: {
    introduction: { type: "string" },
    questions: { type: "array", minItems: 1, maxItems: 5, items: {
      type: "object", additionalProperties: false, required: ["id", "question", "options"],
      properties: {
        id: { type: "string" }, question: { type: "string" },
        options: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
      },
    } },
  },
} as const;

/**
 * O Ollama aplica `type` e `enum` do JSON Schema, mas ignora `minimum`/`maximum`
 * e não entende regra de negócio. Observado no gemma3:4b: confidence vindo como
 * 85 ou 1.0 em vez de 0..1, e requiredAction/securityGuidance preenchidos mesmo
 * quando requiredActor não é OWNER. Ambos precisam ser corrigidos antes do Zod.
 */
export function normalizeDiagnosis(raw: Record<string, unknown>): Record<string, unknown> {
  const rawConfidence = typeof raw.confidence === "number" && Number.isFinite(raw.confidence) ? raw.confidence : 0.5;
  const confidence = Math.min(1, Math.max(0, rawConfidence > 1 ? rawConfidence / 100 : rawConfidence));
  const ownerFields = raw.requiredActor === "OWNER" ? {} : { ownerActionCategory: null, requiredAction: null, securityGuidance: null };
  return { ...raw, ...ownerFields, confidence };
}

export class CentralIaSupportProvider {
  private lastModel: string | undefined;

  constructor(
    private readonly baseUrl = process.env.CENTRAL_IA_BASE_URL?.trim(),
    private readonly timeoutMs = Number(process.env.CENTRAL_IA_REQUEST_TIMEOUT_MS) || 120_000,
    private readonly apiToken = process.env.CENTRAL_IA_API_TOKEN?.trim(),
  ) {}

  async diagnose(input: SupportTicketInput, correlationId: string): Promise<SupportDiagnosis> {
    if (!this.baseUrl) throw new Error("CENTRAL_IA_NOT_CONFIGURED");
    // A regra numerada de changeClass não é redundante: sem ela, o gemma3:4b
    // classificou um bug evidente como FUNCTIONAL_CHANGE/NEW_TOOL em 4 de 5
    // execuções, e supportApprovalPolicy então exigia aprovação do proprietário
    // para uma correção simples. Com a regra explícita, 4/4 corretos.
    const system = "Você faz triagem técnica do G-SIPRO. Analise somente as evidências fornecidas. Não afirme que uma correção foi executada.\n\nRegra de decisão para changeClass, aplique nesta ordem:\n1. CORRECTION — o chamado relata algo que deveria funcionar e está falhando (erro, exceção, tela travada, resultado errado). Corrigir defeito é SEMPRE CORRECTION.\n2. CONFIGURATION — a solução é ajustar parâmetro, permissão ou cadastro, sem alterar código.\n3. FUNCTIONAL_CHANGE — o solicitante pede que um comportamento que JÁ funciona passe a funcionar de forma diferente.\n4. NEW_TOOL — o solicitante pede recurso, tela ou relatório que ainda não existe.\nCorrigir um defeito NUNCA é FUNCTIONAL_CHANGE nem NEW_TOOL.\n\nIdentifique quem executa a próxima ação: AI para código e automações, MASTER para administração comum dentro do G-SIPRO, OWNER somente para configurações externas protegidas, segurança, Azure, Microsoft 365, Teams ou concessão de perfil mestre/proprietário, e REQUESTER quando faltarem evidências. Quando requiredActor for OWNER, preencha categoria, ação exata de menor privilégio e orientação de segurança; nos demais casos retorne null nesses três campos. O campo recommendedAction descreve a ação técnica recomendada, nunca quem deve executá-la. confidence é um número entre 0 e 1. Responda somente com o JSON solicitado, sem texto adicional.";
    const message = `Tipo: ${input.type}\nPrioridade informada: ${input.priority}\nTítulo: ${input.title}\nDescrição: ${input.description}\nTela: ${input.pagePath || "não informada"}\nErro: ${input.errorMessage || "não informado"}\nPassos: ${input.stepsToReproduce || "não informados"}\nContexto técnico: ${JSON.stringify(input.clientContext || {})}`;
    const text = await this.callChat(message, system, triageResponseFormat, correlationId);
    return supportDiagnosisSchema.parse(normalizeDiagnosis(JSON.parse(text)));
  }

  async clarify(input: { title: string; description: string; errorMessage?: string | null; stepsToReproduce?: string | null; resolution?: string | null; reason: string; attempt: number }, correlationId: string): Promise<SupportClarification> {
    if (!this.baseUrl) throw new Error("CENTRAL_IA_NOT_CONFIGURED");
    const system = "Você coleta evidências objetivas para suporte do G-SIPRO. Não converse livremente, não diagnostique novamente e não afirme que o problema foi resolvido. Faça somente perguntas indispensáveis para reproduzir o que ainda falha. Gere de 1 a 5 perguntas curtas. Cada pergunta deve ter de 2 a 4 respostas prontas, mutuamente exclusivas — não inclua você mesmo uma opção genérica como 'Outra', a interface já acrescenta essa opção automaticamente. Responda somente com o JSON solicitado, sem texto adicional.";
    const message = `Título: ${input.title}\nDescrição original: ${input.description}\nErro original: ${input.errorMessage || "não informado"}\nPassos originais: ${input.stepsToReproduce || "não informados"}\nSolução entregue: ${input.resolution || "não informada"}\nMotivo da rejeição: ${input.reason}\nTentativa completa: ${input.attempt} de 3`;
    const text = await this.callChat(message, system, clarificationResponseFormat, correlationId);
    return supportClarificationSchema.parse(JSON.parse(text));
  }

  get modelName() { return this.lastModel ?? "central-ia"; }

  private headers(correlationId: string): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "X-Client-Request-Id": correlationId,
      ...(this.apiToken ? { Authorization: `Bearer ${this.apiToken}` } : {}),
    };
  }

  /** Requisição curta, com limite próprio — nunca espera a inferência inteira. */
  private async request(path: string, correlationId: string, body?: object): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        method: body ? "POST" : "GET",
        signal: controller.signal,
        headers: this.headers(correlationId),
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Cria o trabalho na Central IA e consulta até concluir.
   *
   * A Central IA processa a inferência em segundo plano justamente para que
   * nenhuma requisição HTTP fique aberta por minutos: com o gemma4:12b em CPU,
   * uma triagem passa de 300s e estourava três limites diferentes em sequência
   * (cliente, a própria Central IA e o `fetch` do Node), além dos limites do
   * túnel e do ingress do Azure. Aqui cada chamada dura ~300ms; a espera vira
   * uma sequência de consultas curtas.
   */
  private async callChat(message: string, system: string, format: object, correlationId: string): Promise<string> {
    const created = await this.request("/chat", correlationId, { message, system, format });
    if (!created.ok) throw new Error(`CENTRAL_IA_HTTP_${created.status}`);
    const job = await created.json() as { job_id?: string };
    if (!job.job_id) throw new Error("CENTRAL_IA_JOB_NOT_CREATED");

    const deadline = Date.now() + Math.min(Math.max(this.timeoutMs, 5_000), 600_000);
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      const polled = await this.request(`/chat/${job.job_id}`, correlationId);
      if (!polled.ok) throw new Error(`CENTRAL_IA_HTTP_${polled.status}`);
      const status = await polled.json() as { status?: string; response?: string; model?: string; error?: string };
      if (status.status === "error") throw new Error(`CENTRAL_IA_JOB_FAILED: ${status.error ?? "sem detalhe"}`);
      if (status.status === "done") {
        if (!status.response) throw new Error("CENTRAL_IA_EMPTY_OUTPUT");
        this.lastModel = status.model;
        return status.response;
      }
    }
    throw new Error("CENTRAL_IA_JOB_TIMEOUT");
  }
}
