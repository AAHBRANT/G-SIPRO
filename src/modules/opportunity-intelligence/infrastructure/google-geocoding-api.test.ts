import { describe, expect, it, vi } from "vitest";

import { ConfigurationError } from "@/core/errors/application-error";
import { GoogleGeocodingApi } from "./google-geocoding-api";

describe("GoogleGeocodingApi", () => {
  it("converte endereço confirmado em coordenadas sem expor a chave", async () => {
    let requestedUrl = "";
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      requestedUrl = input.toString();
      return new Response(JSON.stringify({
        status: "OK",
        results: [{
          formatted_address: "Gravataí - RS, Brasil",
          geometry: { location: { lat: -29.9448, lng: -50.9919 }, location_type: "APPROXIMATE" },
          place_id: "place-1",
        }],
      }), { status: 200 });
    });
    const result = await new GoogleGeocodingApi("server-secret", fetcher as typeof fetch).locate("Gravataí/RS");
    expect(result).toMatchObject({ latitude: -29.9448, longitude: -50.9919, provider: "GOOGLE_GEOCODING" });
    const requested = new URL(requestedUrl);
    expect(requested.searchParams.get("address")).toBe("Gravataí/RS");
    expect(JSON.stringify(result)).not.toContain("server-secret");
  });

  it("orienta uso avançado quando a integração não está configurada", async () => {
    await expect(new GoogleGeocodingApi("", vi.fn() as typeof fetch).locate("Gravataí/RS"))
      .rejects.toBeInstanceOf(ConfigurationError);
  });
});
