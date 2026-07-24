import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError, ConfigurationError } from "@/core/errors/application-error";
import { getEnvironment, parseEnvironment, resetEnvironmentCache } from "@/core/config/env";

describe("parseEnvironment", () => {
  afterEach(() => {
    resetEnvironmentCache();
    vi.unstubAllEnvs();
  });

  it("aplica padrões seguros e aceita PostgreSQL", () => {
    const environment = parseEnvironment({ DATABASE_URL: "postgresql://user:pass@localhost:5432/gsipro" });
    expect(environment.APP_NAME).toBe("G-SIPRO");
    expect(environment.NODE_ENV).toBe("development");
    expect(environment.MICROSOFT_GRAPH_TIMEOUT_MS).toBe(20_000);
  });

  it("valida o identificador do aplicativo do catálogo do Teams", () => {
    expect(() => parseEnvironment({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/gsipro",
      TEAMS_CATALOG_APP_ID: "identificador-invalido",
    })).toThrow(ConfigurationError);
  });

  it("não expõe o valor inválido no erro", () => {
    expect(() => parseEnvironment({ DATABASE_URL: "segredo-invalido" })).toThrow(ConfigurationError);
    try {
      parseEnvironment({ DATABASE_URL: "segredo-invalido" });
    } catch (error) {
      expect(String(error)).not.toContain("segredo-invalido");
    }
  });

  it("mantém cache até uma reinicialização explícita", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/gsipro");
    vi.stubEnv("APP_NAME", "G-SIPRO");
    const first = getEnvironment();
    vi.stubEnv("APP_NAME", "G-SIPRO-ALTERADO");
    expect(getEnvironment()).toBe(first);
    resetEnvironmentCache();
    expect(getEnvironment().APP_NAME).toBe("G-SIPRO-ALTERADO");
  });

  it("padroniza erros de autorização sem detalhes sensíveis", () => {
    const error = new AuthorizationError();
    expect(error.code).toBe("ACCESS_DENIED");
    expect(error.status).toBe(403);
  });
});
