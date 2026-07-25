import { describe, expect, it, vi } from "vitest";

import {
  OperationalBaseRegistrationService,
  OperationalBaseService,
  type OperationalBaseRepository,
} from "./operational-base-service";

describe("OperationalBaseService", () => {
  it("normalizes and delegates a valid base", async () => {
    const repository = { create: vi.fn(), listActive: vi.fn() } satisfies OperationalBaseRepository;
    await new OperationalBaseService(repository).create({
      code: "sede",
      name: "Sede",
      locality: "Belo Horizonte/MG",
      latitude: -19.92,
      longitude: -43.94,
      source: "Cadastro corporativo",
    }, "00000000-0000-4000-8000-000000000001");
    expect(repository.create.mock.calls[0]?.[0].code).toBe("SEDE");
  });

  it("geocodes an address and stores a reusable operational base", async () => {
    const repository = { create: vi.fn(), listActive: vi.fn() } satisfies OperationalBaseRepository;
    const geocoder = {
      locate: vi.fn().mockResolvedValue({
        formattedAddress: "João Pessoa, Paraíba, Brasil",
        latitude: -7.1153201234,
        longitude: -34.8610519876,
        precision: "Rooftop",
      }),
    };
    await new OperationalBaseRegistrationService(repository, geocoder).createFromAddress({
      code: "filial-01",
      name: "Filial João Pessoa",
      address: "João Pessoa/PB",
    }, "00000000-0000-4000-8000-000000000001");

    expect(geocoder.locate).toHaveBeenCalledWith("João Pessoa/PB");
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      code: "FILIAL-01",
      name: "Filial João Pessoa",
      locality: "João Pessoa, Paraíba, Brasil",
      latitude: -7.1153201,
      longitude: -34.861052,
      source: "Azure Maps · Rooftop",
    }), "00000000-0000-4000-8000-000000000001", expect.any(String));
  });
});
