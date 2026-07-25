import { describe, expect, it } from "vitest";

import {
  SUPPORT_EXECUTION_LEASE_MINUTES,
  supportLeaseCutoff,
  supportStatusAfterExpiredLease,
} from "@/modules/support/domain/support-lease";

describe("support execution lease", () => {
  it("devolve correções interrompidas para a fila automática", () => {
    expect(supportStatusAfterExpiredLease({ type: "BUG", executionAttempts: 1 })).toBe("TRIAGED");
  });

  it("preserva a aprovação já concedida para melhorias", () => {
    expect(supportStatusAfterExpiredLease({ type: "IMPROVEMENT", executionAttempts: 1 })).toBe("APPROVED");
  });

  it("escala somente depois das três tentativas", () => {
    expect(supportStatusAfterExpiredLease({ type: "BUG", executionAttempts: 3 })).toBe("ESCALATED");
  });

  it("calcula o limite de inatividade da reserva", () => {
    const now = new Date("2026-07-25T15:00:00.000Z");
    expect(supportLeaseCutoff(now).toISOString()).toBe(
      new Date(now.getTime() - SUPPORT_EXECUTION_LEASE_MINUTES * 60_000).toISOString(),
    );
  });
});
