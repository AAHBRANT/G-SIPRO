import { describe, expect, it } from "vitest";

import { evaluateIntelligenceIntegrationReadiness } from "./integration-readiness";

describe("evaluateIntelligenceIntegrationReadiness", () => {
  it("não retorna valores de credenciais, apenas identificadores ausentes", () => {
    const secret = "segredo-que-nao-pode-ser-exposto";
    const result = evaluateIntelligenceIntegrationReadiness({ AZURE_MAPS_CLIENT_ID: secret });

    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.find(({ code }) => code === "AZURE_MAPS")?.status).toBe("READY");
  });

  it("orienta o proprietário quando uma integração administrativa está incompleta", () => {
    const result = evaluateIntelligenceIntegrationReadiness({});
    const teams = result.find(({ code }) => code === "TEAMS_ACTIVITY");

    expect(teams).toMatchObject({
      status: "OWNER_ACTION_REQUIRED",
      responsible: "PROPRIETARIO",
    });
    expect(teams?.missingConfiguration).toContain("TEAMS_CATALOG_APP_ID");
  });

  it("usa uma única identidade segura para localização, rotas e mapas", () => {
    const result = evaluateIntelligenceIntegrationReadiness({ AZURE_MAPS_CLIENT_ID: "maps-client-id" });
    expect(result.find(({ code }) => code === "AZURE_MAPS")?.status).toBe("READY");
  });
});
