import { afterEach, describe, expect, it, vi } from "vitest";

import { resetEnvironmentCache } from "@/core/config/env";
import {
  classifyGraphFailure,
  installTeamsAppForUser,
  resolveEntraIdentityByEmail,
  resetMicrosoftGraphTokenCache,
} from "@/modules/admin/microsoft-graph-teams-provisioner";

const baseEnvironment = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/gsipro",
  ENTRA_TENANT_ID: "8cc518ea-6df8-4d1e-a79f-89ee9314335c",
  ENTRA_CLIENT_ID: "e9db2cdd-b997-4e45-8d2e-8b3a64147367",
  ENTRA_CLIENT_SECRET: "segredo-de-cliente-com-tamanho-valido",
  TEAMS_CATALOG_APP_ID: "a3e5f89d-b77d-4fd7-a4dd-ed88c36af16c",
};

function configureEnvironment() {
  for (const [key, value] of Object.entries(baseEnvironment)) vi.stubEnv(key, value);
}

describe("Microsoft Graph Teams provisioner", () => {
  afterEach(() => {
    resetEnvironmentCache();
    resetMicrosoftGraphTokenCache();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("não chama a rede quando a integração não está configurada", async () => {
    vi.stubEnv("DATABASE_URL", baseEnvironment.DATABASE_URL);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(installTeamsAppForUser("usuario@aahbrant.com")).resolves.toMatchObject({
      status: "NOT_CONFIGURED",
      errorCode: "GRAPH_NOT_CONFIGURED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("obtém token de aplicativo e instala o G-SIPRO para o usuário", async () => {
    configureEnvironment();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token-seguro", expires_in: 3_600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(installTeamsAppForUser("usuario+teste@aahbrant.com")).resolves.toMatchObject({ status: "INSTALLED", errorCode: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toContain("usuario%2Bteste%40aahbrant.com/teamwork/installedApps");
    expect(fetchMock.mock.calls[1]?.[1]?.body).toContain(baseEnvironment.TEAMS_CATALOG_APP_ID);
  });

  it("trata conflito como instalação já existente", async () => {
    configureEnvironment();
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token-seguro", expires_in: 3_600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 409 })));

    await expect(installTeamsAppForUser("usuario@aahbrant.com")).resolves.toMatchObject({ status: "INSTALLED" });
  });

  it("resolve o identificador real do usuário no Microsoft Entra", async () => {
    configureEnvironment();
    const objectId = "a9cbdad7-7ab0-4dc5-876f-38d05a5a4f38";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token-seguro", expires_in: 3_600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: objectId, accountEnabled: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveEntraIdentityByEmail("usuario@aahbrant.com")).resolves.toMatchObject({
      status: "RESOLVED",
      objectId,
      errorCode: null,
    });
    expect(fetchMock.mock.calls[1]?.[0]).toContain("users/usuario%40aahbrant.com");
  });

  it("mantém o acesso interno com orientação segura quando falta permissão de leitura", async () => {
    configureEnvironment();
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token-seguro", expires_in: 3_600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 403 })));

    await expect(resolveEntraIdentityByEmail("usuario@aahbrant.com")).resolves.toMatchObject({
      status: "FAILED",
      objectId: null,
      errorCode: "GRAPH_USER_READ_PERMISSION_REQUIRED",
    });
  });

  it("resolve o id interno do catálogo quando a configuração contém o id do manifesto", async () => {
    configureEnvironment();
    const catalogResourceId = "b1c5353a-7aca-41b3-830f-27d5218fe0e5";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token-seguro", expires_in: 3_600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{ id: catalogResourceId, externalId: baseEnvironment.TEAMS_CATALOG_APP_ID }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(installTeamsAppForUser("usuario@aahbrant.com")).resolves.toMatchObject({ status: "INSTALLED", errorCode: null });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[2]?.[0]).toContain("externalId");
    expect(fetchMock.mock.calls[3]?.[1]?.body).toContain(catalogResourceId);
  });

  it("orienta a permissão necessária quando o catálogo não pode ser consultado", async () => {
    configureEnvironment();
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token-seguro", expires_in: 3_600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 400 }))
      .mockResolvedValueOnce(new Response(null, { status: 403 })));

    await expect(installTeamsAppForUser("usuario@aahbrant.com")).resolves.toMatchObject({
      status: "FAILED",
      errorCode: "GRAPH_APP_CATALOG_PERMISSION_REQUIRED",
    });
  });

  it("classifica falhas sem expor a resposta do provedor", () => {
    expect(classifyGraphFailure(403)).toBe("GRAPH_PERMISSION_REQUIRED");
    expect(classifyGraphFailure(404)).toBe("ENTRA_USER_NOT_FOUND");
    expect(classifyGraphFailure(429)).toBe("GRAPH_TEMPORARY_FAILURE");
    expect(classifyGraphFailure(500)).toBe("GRAPH_TEMPORARY_FAILURE");
  });
});
