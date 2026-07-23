import { describe, expect, it } from "vitest";
import { supportAssistantDisposition } from "./support-assistant";

describe("support assistant disposition", () => {
  it("keeps an authorized ticket in the automatic queue", () => {
    const result = supportAssistantDisposition("TRIAGED", false);
    expect(result.nextStatus).toBeUndefined();
    expect(result.resetExecution).toBeUndefined();
    expect(result.response).toContain("fila automática");
  });

  it("does not bypass owner approval", () => {
    const result = supportAssistantDisposition("WAITING_APPROVAL", true);
    expect(result.nextStatus).toBeUndefined();
    expect(result.response).toContain("aprovação");
  });

  it("returns an owner-assumed ticket to the automatic queue from the chat", () => {
    expect(supportAssistantDisposition("IN_PROGRESS", true, "proprietario")).toMatchObject({
      nextStatus: "TRIAGED",
      resetExecution: true,
    });
  });

  it("does not interrupt a running automatic executor", () => {
    expect(supportAssistantDisposition("IN_PROGRESS", true, "github-codex-123").nextStatus).toBeUndefined();
  });

  it("does not treat an owner blocker as completed from a chat message", () => {
    const result = supportAssistantDisposition("OWNER_ACTION_REQUIRED", true);
    expect(result.nextStatus).toBeUndefined();
    expect(result.response).toContain("Confirmar ação");
  });

  it("lets the owner start a fresh automated cycle after escalation", () => {
    expect(supportAssistantDisposition("ESCALATED", true)).toMatchObject({
      nextStatus: "TRIAGED",
      resetExecution: true,
    });
  });

  it("keeps an escalated ticket protected from other users", () => {
    expect(supportAssistantDisposition("ESCALATED", false).nextStatus).toBeUndefined();
  });
});
