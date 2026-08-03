import { afterEach, describe, expect, it, vi } from "vitest";
import { CentralIaSupportProvider, normalizeDiagnosis } from "./central-ia-support-provider";

const diagnosisPayload = {
  summary: "Resumo", probableCause: "Causa", severity: "MEDIUM", changeClass: "CORRECTION",
  requiredActor: "AI", ownerActionCategory: null, requiredAction: null, securityGuidance: null,
  recommendedAction: "Corrigir", suggestedTests: ["Reproduzir"], userGuidance: "Acompanhe", confidence: 0.8,
};

describe("normalizeDiagnosis", () => {
  it("rescales confidence returned as percentage", () => {
    expect(normalizeDiagnosis({ requiredActor: "AI", confidence: 85 }).confidence).toBe(0.85);
  });

  it("clamps confidence into the 0..1 range", () => {
    expect(normalizeDiagnosis({ requiredActor: "AI", confidence: 1 }).confidence).toBe(1);
    expect(normalizeDiagnosis({ requiredActor: "AI", confidence: -3 }).confidence).toBe(0);
  });

  it("falls back to a neutral confidence when the model omits a number", () => {
    expect(normalizeDiagnosis({ requiredActor: "AI", confidence: "alta" }).confidence).toBe(0.5);
  });

  it("clears owner-only fields when the actor is not OWNER", () => {
    const result = normalizeDiagnosis({ requiredActor: "MASTER", confidence: 0.5, ownerActionCategory: "AZURE", requiredAction: "algo", securityGuidance: "algo" });
    expect(result).toMatchObject({ ownerActionCategory: null, requiredAction: null, securityGuidance: null });
  });

  it("keeps owner-only fields when the actor is OWNER", () => {
    const result = normalizeDiagnosis({ requiredActor: "OWNER", confidence: 0.5, ownerActionCategory: "AZURE", requiredAction: "conceder acesso", securityGuidance: "menor privilégio" });
    expect(result).toMatchObject({ ownerActionCategory: "AZURE", requiredAction: "conceder acesso", securityGuidance: "menor privilégio" });
  });
});

describe("CentralIaSupportProvider", () => {
  it("fails safely without a base URL", async () => {
    const provider = new CentralIaSupportProvider("");
    await expect(provider.diagnose({ type: "BUG", priority: "NORMAL", title: "Falha ao salvar", description: "O botão não conclui a operação." }, crypto.randomUUID())).rejects.toThrow("CENTRAL_IA_NOT_CONFIGURED");
  });

  it("does not generate clarification questions without a base URL", async () => {
    const provider = new CentralIaSupportProvider("");
    await expect(provider.clarify({ title: "Falha ao salvar", description: "O botão não conclui a operação.", reason: "O mesmo erro continua.", attempt: 1 }, crypto.randomUUID())).rejects.toThrow("CENTRAL_IA_NOT_CONFIGURED");
  });

  // Regressão de uma falha real: sem teto no array, o modelo entrou em fuga de
  // geração, passou de 2.229 tokens (o normal é ~285) e a triagem só terminou
  // quando o timeout de 540s a cortou, jogando o chamado no fallback sem IA.
  it("bounds the arrays it asks the model to produce", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ job_id: "j1" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "done", response: JSON.stringify(diagnosisPayload), model: "gemma4:12b" }) });
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    const provider = new CentralIaSupportProvider("http://central-ia.test");
    const pending = provider.diagnose({ type: "BUG", priority: "NORMAL", title: "Falha ao salvar", description: "O botão não conclui a operação." }, crypto.randomUUID());
    await vi.advanceTimersByTimeAsync(6_000);
    await expect(pending).resolves.toMatchObject({ changeClass: "CORRECTION" });

    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body).format;
    expect(sent.properties.suggestedTests.maxItems).toBeLessThanOrEqual(5);
    expect(provider.modelName).toBe("gemma4:12b");
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
