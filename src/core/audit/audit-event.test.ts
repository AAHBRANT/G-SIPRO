import { describe, expect, it } from "vitest";

import { createAuditEvent } from "@/core/audit/audit-event";

describe("createAuditEvent", () => {
  it("cria evento válido, identificado e imutável", () => {
    const event = createAuditEvent({
      actorType: "USER",
      actorId: "user-1",
      action: "OPPORTUNITY_CREATED",
      entityType: "Opportunity",
      entityId: "opportunity-1",
      correlationId: "35b60e2a-a448-4c5b-ac58-9185be2e6bc7",
      outcome: "SUCCESS",
      origin: "unit-test",
    });
    expect(event.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(Object.isFrozen(event)).toBe(true);
  });

  it("rejeita correlação inválida", () => {
    expect(() =>
      createAuditEvent({
        actorType: "SYSTEM",
        actorId: "system",
        action: "STARTED",
        entityType: "Application",
        correlationId: "invalid",
        outcome: "SUCCESS",
        origin: "unit-test",
      }),
    ).toThrow();
  });
});
