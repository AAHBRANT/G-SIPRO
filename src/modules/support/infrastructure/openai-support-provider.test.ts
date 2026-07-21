import { describe, expect, it } from "vitest";
import { OpenAiSupportProvider } from "./openai-support-provider";

describe("OpenAiSupportProvider", () => {
  it("fails safely without a server key", async () => {
    const provider = new OpenAiSupportProvider("");
    await expect(provider.diagnose({ type: "BUG", priority: "NORMAL", title: "Falha ao salvar", description: "O botão não conclui a operação." }, crypto.randomUUID())).rejects.toThrow("OPENAI_NOT_CONFIGURED");
  });

  it("does not generate clarification questions without a server key", async () => {
    const provider = new OpenAiSupportProvider("");
    await expect(provider.clarify({ title: "Falha ao salvar", description: "O botão não conclui a operação.", reason: "O mesmo erro continua.", attempt: 1 }, crypto.randomUUID())).rejects.toThrow("OPENAI_NOT_CONFIGURED");
  });
});
