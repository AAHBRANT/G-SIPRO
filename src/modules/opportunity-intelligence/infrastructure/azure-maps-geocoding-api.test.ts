import { describe, expect, it, vi } from "vitest";

import { ConfigurationError } from "@/core/errors/application-error";
import { AzureMapsGeocodingApi } from "./azure-maps-geocoding-api";

describe("AzureMapsGeocodingApi", () => {
  it("converte endereço em coordenadas sem expor a credencial", async () => {
    let requestedUrl = "";
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = input.toString();
      expect((init?.headers as Record<string, string>)["subscription-key"]).toBe("server-secret");
      return new Response(JSON.stringify({
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: {
            address: { formattedAddress: "Gravataí, RS, Brasil" },
            confidence: "High",
            geocodePoints: [{ calculationMethod: "Interpolation" }],
          },
          geometry: { type: "Point", coordinates: [-50.9919, -29.9448] },
        }],
      }), { status: 200 });
    });
    const result = await new AzureMapsGeocodingApi(
      { subscriptionKey: "server-secret", timeoutMs: 5_000 },
      fetcher as typeof fetch,
    ).locate("Gravataí/RS");
    expect(result).toMatchObject({ latitude: -29.9448, longitude: -50.9919, provider: "AZURE_MAPS" });
    expect(new URL(requestedUrl).searchParams.get("query")).toBe("Gravataí/RS, Brasil");
    expect(requestedUrl).not.toContain("server-secret");
    expect(JSON.stringify(result)).not.toContain("server-secret");
  });

  it("orienta configuração quando nenhuma identidade está disponível", async () => {
    const previousEndpoint = process.env.IDENTITY_ENDPOINT;
    const previousHeader = process.env.IDENTITY_HEADER;
    delete process.env.IDENTITY_ENDPOINT;
    delete process.env.IDENTITY_HEADER;
    await expect(new AzureMapsGeocodingApi(
      { clientId: "maps-client-id", timeoutMs: 5_000 },
      vi.fn() as typeof fetch,
    ).locate("Gravataí/RS")).rejects.toBeInstanceOf(ConfigurationError);
    process.env.IDENTITY_ENDPOINT = previousEndpoint;
    process.env.IDENTITY_HEADER = previousHeader;
  });
});
