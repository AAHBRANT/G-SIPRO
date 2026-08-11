import { describe, expect, it } from "vitest";
import { supportResolutionForecast } from "./support-resolution-forecast";

const ticket = {
  priority: "NORMAL",
  type: "BUG",
  createdAt: "2026-07-23T12:00:00.000Z",
  updatedAt: "2026-07-23T12:05:00.000Z",
  executionAttempts: 1,
};

describe("supportResolutionForecast", () => {
  it("estimates an active AI execution", () => {
    const result = supportResolutionForecast(
      { ...ticket, status: "IN_PROGRESS", executionClaimedAt: "2026-07-23T12:10:00.000Z" },
      new Date("2026-07-23T12:20:00.000Z"),
    );
    expect(result).toMatchObject({
      state: "ON_TRACK",
      responsible: "GUULY do G-SIPRO",
      remainingMinutes: 35,
    });
    expect(result.nextActions[0]).toMatchObject({
      label: "Concluir a execução técnica",
      responsible: "GUULY do G-SIPRO",
      state: "CURRENT",
    });
    expect(result.estimateAt).toBe("2026-07-23T12:55:00.000Z");
  });

  it("marks an exceeded estimate without closing the ticket", () => {
    const result = supportResolutionForecast(
      { ...ticket, status: "IN_PROGRESS", executionClaimedAt: "2026-07-23T12:10:00.000Z" },
      new Date("2026-07-23T13:10:00.000Z"),
    );
    expect(result).toMatchObject({ state: "OVERDUE", headline: "Previsão excedida", remainingMinutes: -15 });
  });

  it("pauses the forecast while the owner must act", () => {
    expect(supportResolutionForecast(
      { ...ticket, status: "OWNER_ACTION_REQUIRED" },
      new Date("2026-07-23T13:00:00.000Z"),
    )).toMatchObject({
      state: "WAITING",
      responsible: "Proprietário",
      estimateAt: null,
    });
    const result = supportResolutionForecast(
      { ...ticket, status: "OWNER_ACTION_REQUIRED" },
      new Date("2026-07-23T13:00:00.000Z"),
    );
    expect(result.nextActions[0]).toMatchObject({
      label: "Executar e confirmar a ação protegida",
      responsible: "Proprietário",
      state: "CURRENT",
    });
  });

  it("reports the actual duration after resolution", () => {
    expect(supportResolutionForecast(
      { ...ticket, status: "RESOLVED", resolvedAt: "2026-07-23T12:42:00.000Z" },
      new Date("2026-07-23T14:00:00.000Z"),
    )).toMatchObject({
      state: "DONE",
      elapsedMinutes: 42,
      responsible: "Concluído",
      pendingSummary: "Nenhuma ação pendente.",
      nextActions: [],
    });
  });
});
