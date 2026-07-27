import {
  attractivenessPointInputSchema,
  type AttractivenessPointInput,
  type AttractivenessPointRecord,
} from "../domain/attractiveness-point";

export interface AttractivenessRepository {
  create(opportunityId: string, input: AttractivenessPointInput, actorId: string): Promise<AttractivenessPointRecord>;
  list(opportunityId: string): Promise<readonly AttractivenessPointRecord[]>;
}

export class AttractivenessService {
  constructor(private readonly repository: AttractivenessRepository) {}

  add(opportunityId: string, input: unknown, actorId: string) {
    const parsed = attractivenessPointInputSchema.parse(input);
    return this.repository.create(opportunityId, parsed, actorId);
  }

  list(opportunityId: string) {
    return this.repository.list(opportunityId);
  }
}
