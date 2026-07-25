import { z } from "zod";

import { ValidationError } from "@/core/errors/application-error";
import { AzureMapsClient, type AzureMapsConfiguration } from "./azure-maps-client";

const azureGeocodingResponseSchema = z.object({
  features: z.array(z.object({
    properties: z.object({
      address: z.object({
        formattedAddress: z.string().min(1),
      }),
      confidence: z.string().optional(),
      geocodePoints: z.array(z.object({
        calculationMethod: z.string().optional(),
      })).optional(),
    }),
    geometry: z.object({
      type: z.literal("Point"),
      coordinates: z.tuple([
        z.number().min(-180).max(180),
        z.number().min(-90).max(90),
      ]),
    }),
  })),
});

export type GeocodedAddress = Readonly<{
  formattedAddress: string;
  latitude: number;
  longitude: number;
  precision: string;
  placeId: string;
  provider: "AZURE_MAPS";
}>;

export class AzureMapsGeocodingApi {
  private readonly client: AzureMapsClient;

  constructor(configuration?: AzureMapsConfiguration, fetcher: typeof fetch = fetch) {
    this.client = new AzureMapsClient(configuration, fetcher);
  }

  async locate(addressInput: string): Promise<GeocodedAddress> {
    const address = z.string().trim().min(2).max(500).parse(addressInput);
    const url = new URL("https://atlas.microsoft.com/geocode");
    url.searchParams.set("api-version", "2026-01-01");
    url.searchParams.set("query", `${address}, Brasil`);
    url.searchParams.set("top", "1");

    const response = await this.client.request(url);
    const data = azureGeocodingResponseSchema.parse(await response.json());
    const result = data.features[0];
    if (!result) {
      throw new ValidationError(
        "Não foi possível localizar esse endereço. Complete cidade e UF ou informe a localização avançada.",
      );
    }
    const [longitude, latitude] = result.geometry.coordinates;
    return {
      formattedAddress: result.properties.address.formattedAddress,
      latitude,
      longitude,
      precision: result.properties.geocodePoints?.[0]?.calculationMethod
        ?? result.properties.confidence
        ?? "Azure Maps",
      placeId: `${longitude},${latitude}`,
      provider: "AZURE_MAPS",
    };
  }
}
