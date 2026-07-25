import { z } from "zod";

import { ConfigurationError, ValidationError } from "@/core/errors/application-error";

export type AzureMapsConfiguration = Readonly<{
  clientId?: string;
  subscriptionKey?: string;
  timeoutMs: number;
}>;

const managedIdentityResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_on: z.union([z.string(), z.number()]).optional(),
});

let cachedToken: { value: string; expiresAt: number } | undefined;

export function azureMapsConfigurationFromEnvironment(): AzureMapsConfiguration {
  const clientId = process.env.AZURE_MAPS_CLIENT_ID?.trim();
  const subscriptionKey = process.env.AZURE_MAPS_SUBSCRIPTION_KEY?.trim();
  if (!clientId && !subscriptionKey) {
    throw new ConfigurationError(
      "O Azure Maps ainda não foi configurado para o G-SIPRO.",
      { missing: "AZURE_MAPS_CLIENT_ID" },
    );
  }
  const timeout = Number(process.env.AZURE_MAPS_TIMEOUT_MS) || 30_000;
  return {
    clientId,
    subscriptionKey,
    timeoutMs: Math.min(Math.max(timeout, 5_000), 120_000),
  };
}

export class AzureMapsClient {
  constructor(
    private readonly configuration: AzureMapsConfiguration = azureMapsConfigurationFromEnvironment(),
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async request(url: URL | string, init: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.configuration.timeoutMs);
    try {
      const response = await this.fetcher(url, {
        ...init,
        headers: {
          accept: "application/json",
          ...(init.headers ?? {}),
          ...await this.authorizationHeaders(),
        },
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        throw new ValidationError(`O Azure Maps respondeu com status ${response.status}.`);
      }
      return response;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConfigurationError) throw error;
      throw new ValidationError("Não foi possível consultar o Azure Maps.", { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async authorizationHeaders(): Promise<Record<string, string>> {
    if (this.configuration.subscriptionKey) {
      return { "subscription-key": this.configuration.subscriptionKey };
    }
    if (!this.configuration.clientId) {
      throw new ConfigurationError("A identidade do Azure Maps não foi configurada.");
    }
    return {
      authorization: `Bearer ${await this.managedIdentityToken()}`,
      "x-ms-client-id": this.configuration.clientId,
    };
  }

  private async managedIdentityToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
    const endpoint = process.env.IDENTITY_ENDPOINT?.trim();
    const identityHeader = process.env.IDENTITY_HEADER?.trim();
    if (!endpoint || !identityHeader) {
      throw new ConfigurationError(
        "A identidade gerenciada do ambiente ainda não está disponível.",
        { missing: "IDENTITY_ENDPOINT" },
      );
    }
    const url = new URL(endpoint);
    url.searchParams.set("resource", "https://atlas.microsoft.com/");
    url.searchParams.set("api-version", "2019-08-01");
    const response = await this.fetcher(url, {
      headers: { "x-identity-header": identityHeader },
      cache: "no-store",
      signal: AbortSignal.timeout(this.configuration.timeoutMs),
    });
    if (!response.ok) {
      throw new ConfigurationError(`A identidade gerenciada respondeu com status ${response.status}.`);
    }
    const token = managedIdentityResponseSchema.parse(await response.json());
    const parsedExpiry = Number(token.expires_on);
    cachedToken = {
      value: token.access_token,
      expiresAt: Number.isFinite(parsedExpiry) ? parsedExpiry * 1000 : Date.now() + 5 * 60_000,
    };
    return cachedToken.value;
  }
}
