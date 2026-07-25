import { describe, expect, it } from "vitest";

import { evaluateIntelligenceIntegrationReadiness } from "./integration-readiness";

describe("evaluateIntelligenceIntegrationReadiness", () => {
  it("não retorna valores de credenciais, apenas identificadores ausentes", () => {
    const secret = "segredo-que-nao-pode-ser-exposto";
    const result = evaluateIntelligenceIntegrationReadiness({
      GOOGLE_ROUTES_API_KEY: secret,
    });

    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.find(({ code }) => code === "GOOGLE_ROUTES")?.status).toBe("READY");
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

  it("exige chaves separadas para rota de servidor e mapa de navegador", () => {
    const result = evaluateIntelligenceIntegrationReadiness({
      GOOGLE_ROUTES_API_KEY: "server-key",
    });

    expect(result.find(({ code }) => code === "GOOGLE_ROUTES")?.status).toBe("READY");
    expect(result.find(({ code }) => code === "GOOGLE_MAPS")?.status).toBe("OWNER_ACTION_REQUIRED");
  });

  it("apresenta a busca de endereço como configuração independente", () => {
    const result = evaluateIntelligenceIntegrationReadiness({
      GOOGLE_ROUTES_API_KEY: "route-key",
      GOOGLE_GEOCODING_API_KEY: "geocoding-key",
    });

    expect(result.find(({ code }) => code === "GOOGLE_GEOCODING")?.status).toBe("READY");
  });
});
