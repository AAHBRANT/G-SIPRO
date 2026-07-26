import { randomUUID } from "node:crypto";

import { operationalBaseSchema, type OperationalBaseDraft } from "../domain/operational-base";

const operationalBaseAddressSchema = operationalBaseSchema.pick({
  code: true,
  name: true,
}).extend({
  address: operationalBaseSchema.shape.source,
}).strict();

export interface OperationalBaseRepository {
  create(draft: OperationalBaseDraft, actorId: string, correlationId: string): Promise<unknown>;
  listActive(): Promise<readonly unknown[]>;
}

export interface OperationalBaseGeocoder {
  locate(address: string): Promise<Readonly<{
    formattedAddress: string;
    latitude: number;
    longitude: number;
    precision: string;
  }>>;
}

export class OperationalBaseService {
  constructor(private readonly repository: OperationalBaseRepository) {}

  create(input: unknown, actorId: string, correlationId: string = randomUUID()) {
    return this.repository.create(operationalBaseSchema.parse(input), actorId, correlationId);
  }

  listActive() {
    return this.repository.listActive();
  }
}

export class OperationalBaseRegistrationService {
  constructor(
    private readonly repository: OperationalBaseRepository,
    private readonly geocoder: OperationalBaseGeocoder,
  ) {}

  async createFromAddress(
    input: unknown,
    actorId: string,
    correlationId: string = randomUUID(),
  ) {
    const request = operationalBaseAddressSchema.parse(input);
    const location = await this.geocoder.locate(request.address);
    return new OperationalBaseService(this.repository).create({
      code: request.code,
      name: request.name,
      locality: location.formattedAddress,
      latitude: Number(location.latitude.toFixed(7)),
      longitude: Number(location.longitude.toFixed(7)),
      source: `Azure Maps · ${location.precision}`,
    }, actorId, correlationId);
  }
}
