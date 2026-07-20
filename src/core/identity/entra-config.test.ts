import { afterEach, describe, expect, it, vi } from "vitest";

import { resetEnvironmentCache } from "@/core/config/env";
import { ConfigurationError } from "@/core/errors/application-error";
import { getEntraConfiguration } from "@/core/identity/entra-config";

const tenantId = "8cc518ea-6df8-4d1e-a79f-89ee9314335c";
const clientId = "e9db2cdd-b997-4e45-8d2e-8b3a64147367";

describe("getEntraConfiguration", () => {
  afterEach(() => {
    resetEnvironmentCache();
    vi.unstubAllEnvs();
  });

  it("produz emissor restrito ao tenant corporativo", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/gsipro");
    vi.stubEnv("ENTRA_TENANT_ID", tenantId);
    vi.stubEnv("ENTRA_CLIENT_ID", clientId);
    vi.stubEnv("ENTRA_CLIENT_SECRET", "segredo-de-cliente-valido");
    vi.stubEnv("AUTH_SECRET", "a".repeat(32));

    expect(getEntraConfiguration()).toMatchObject({
      clientId,
      issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      tenantId,
    });
  });

  it("falha de forma segura quando a identidade está incompleta", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/gsipro");
    expect(() => getEntraConfiguration()).toThrow(ConfigurationError);
  });
});
