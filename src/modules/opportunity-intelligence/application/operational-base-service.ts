import { randomUUID } from "node:crypto";

import { operationalBaseSchema, type OperationalBaseDraft } from "../domain/operational-base";

export interface OperationalBaseRepository {
  create(draft: OperationalBaseDraft, actorId: string, correlationId: string): Promise<unknown>;
  listActive(): Promise<readonly unknown[]>;
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
