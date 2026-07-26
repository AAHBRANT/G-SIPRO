import { describe, expect, it } from "vitest";

import { intelligenceNotificationDraftSchema, planAnalysisNotifications } from "./intelligence-notification";

const base = {
  opportunityId: "00000000-0000-4000-8000-000000000001",
  opportunityCode: "OPP-001",
  analysisId: "00000000-0000-4000-8000-000000000002",
  analysisVersion: 5,
  recipientId: "00000000-0000-4000-8000-000000000003",
  recommendation: "WAITING_OWNER_DECISION" as const,
  status: "WAITING_OWNER" as const,
  pendingCount: 0,
};

describe("intelligence notification", () => {
  it("creates separate impediment and owner-decision events", () => {
    const result = planAnalysisNotifications({ ...base, hasCriticalImpediment: true });
    expect(result.map(item => item.type)).toEqual(["IMPEDIMENT_DETECTED", "OWNER_DECISION_REQUIRED"]);
    expect(JSON.stringify(result)).not.toContain("assessment");
  });

  it("only accepts safe, authenticated relative links and known payload fields", () => {
    expect(intelligenceNotificationDraftSchema.safeParse({
      ...base,
      type: "ANALYSIS_COMPLETED",
      summary: "Análise concluída com segurança.",
      nextAction: "Abrir o painel e revisar o resultado.",
      deepLink: "https://external.example/phishing",
      financialDetails: { debt: 1000 },
    }).success).toBe(false);
  });
});
