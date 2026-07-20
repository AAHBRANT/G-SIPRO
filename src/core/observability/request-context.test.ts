import { describe, expect, it } from "vitest";

import {
  createRequestContext,
  getRequestContext,
  runWithRequestContext,
} from "@/core/observability/request-context";

describe("request context", () => {
  it("preserva correlação válida durante a operação", () => {
    const context = createRequestContext({
      correlationId: "35b60e2a-a448-4c5b-ac58-9185be2e6bc7",
      actorId: "user-1",
    });
    runWithRequestContext(context, () => expect(getRequestContext()).toEqual(context));
  });

  it("substitui correlação externa inválida por UUID", () => {
    const context = createRequestContext({ correlationId: "valor-controlado-pelo-cliente" });
    expect(context.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(context.correlationId).not.toBe("valor-controlado-pelo-cliente");
  });
});
