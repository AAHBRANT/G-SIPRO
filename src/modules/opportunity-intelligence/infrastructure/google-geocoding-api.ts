import { z } from "zod";

import { ConfigurationError, ValidationError } from "@/core/errors/application-error";

const googleResponseSchema = z.object({
  status: z.string(),
  error_message: z.string().optional(),
  results: z.array(z.object({
    formatted_address: z.string(),
    geometry: z.object({
      location: z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      }),
      location_type: z.string(),
    }),
    place_id: z.string(),
  })),
});

export type GeocodedAddress = Readonly<{
  formattedAddress: string;
  latitude: number;
  longitude: number;
  precision: string;
  placeId: string;
  provider: "GOOGLE_GEOCODING";
}>;

export class GoogleGeocodingApi {
  constructor(
    private readonly apiKey = process.env.GOOGLE_GEOCODING_API_KEY?.trim()
      || process.env.GOOGLE_ROUTES_API_KEY?.trim(),
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async locate(addressInput: string): Promise<GeocodedAddress> {
    const address = z.string().trim().min(2).max(500).parse(addressInput);
    if (!this.apiKey) {
      throw new ConfigurationError(
        "A busca automática de endereço ainda não foi configurada. Use a localização avançada ou solicite a configuração ao administrador.",
        { missing: "GOOGLE_GEOCODING_API_KEY" },
      );
    }
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("region", "br");
    url.searchParams.set("language", "pt-BR");
    url.searchParams.set("key", this.apiKey);

    const response = await this.fetcher(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new ValidationError(`O serviço de localização respondeu com status ${response.status}.`);
    }
    const data = googleResponseSchema.parse(await response.json());
    if (data.status !== "OK" || !data.results[0]) {
      throw new ValidationError(
        data.status === "ZERO_RESULTS"
          ? "Não foi possível localizar esse endereço. Complete cidade e UF ou informe a localização avançada."
          : data.error_message ?? "Não foi possível consultar o endereço informado.",
      );
    }
    const result = data.results[0];
    return {
      formattedAddress: result.formatted_address,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      precision: result.geometry.location_type,
      placeId: result.place_id,
      provider: "GOOGLE_GEOCODING",
    };
  }
}
