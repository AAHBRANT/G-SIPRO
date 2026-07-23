import { describe, expect, it } from "vitest";
import { buildSupportExecutionPackage } from "./support-execution-package";

describe("support execution package", () => {
  it("packages the diagnosis, evidence and acceptance criteria without exposing storage paths", () => {
    const result = buildSupportExecutionPackage({
      id: "ticket-1",
      number: 9,
      type: "BUG",
      priority: "HIGH",
      status: "TRIAGED",
      title: "Falha ao reconhecer acervo",
      description: "O reconhecimento não foi concluído.",
      pagePath: "/technical-archive",
      errorMessage: "Falha de processamento",
      stepsToReproduce: "Importar o arquivo e reconhecer.",
      clientContext: { userAgent: "Teams" },
      aiDiagnosis: {
        summary: "Falha temporária no processamento.",
        probableCause: "Serviço indisponível.",
        recommendedAction: "Tentar novamente.",
        suggestedTests: ["Reconhecimento concluído"],
        changeClass: "CORRECTION",
        requiredActor: "AI",
        ownerActionCategory: null,
        requiredAction: null,
        securityGuidance: null,
        severity: "MEDIUM",
        confidence: 0.9,
      },
      approvalRequired: false,
      approvalReason: "Correção de bug.",
      correlationId: "correlation-1",
      createdAt: new Date("2026-07-20T12:00:00.000Z"),
      reporter: { displayName: "Usuário", email: "usuario@example.com" },
      attachments: [{ id: "attachment-1", fileName: "evidencia.png", fileHash: "hash", mimeType: "image/png", sizeBytes: 2048n }],
      decisions: [],
      executionAttempts: 2,
      resolutionAttempts: 1,
      updates: [{ note: "O problema continua no Teams.", toStatus: "TRIAGED", actorLabel: "Solicitante", createdAt: new Date("2026-07-20T13:00:00.000Z"), createdBy: null }],
    });

    expect(result.ticket.code).toBe("SUP-00009");
    expect(result.acceptanceCriteria).toEqual(["Reconhecimento concluído"]);
    expect(result.attachments[0]).toMatchObject({
      sizeBytes: "2048",
      contentPath: "/api/support/attachments/attachment-1/content",
    });
    expect(result.attachments[0]).not.toHaveProperty("uri");
    expect(result.execution.currentAttempt).toBe(2);
    expect(result.history[0]).toMatchObject({ note: "O problema continua no Teams.", actor: "Solicitante" });
  });
});
