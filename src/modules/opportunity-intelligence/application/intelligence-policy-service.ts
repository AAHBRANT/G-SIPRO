import { randomUUID } from "node:crypto";
import {
  intelligencePolicyApprovalSchema,
  intelligencePolicySchema,
  type IntelligencePolicyApprovalDraft,
  type IntelligencePolicyDraft,
} from "../domain/intelligence-policy";

export interface IntelligencePolicyRepository {
  addPolicy(draft: IntelligencePolicyDraft, actorId: string, correlationId: string): Promise<unknown>;
  approvePolicy(id: string, draft: IntelligencePolicyApprovalDraft, actorId: string, correlationId: string): Promise<unknown>;
}

export class IntelligencePolicyService {
  constructor(private readonly repository: IntelligencePolicyRepository) {}

  addPolicy(input: unknown, actorId: string, correlationId: string = randomUUID()) {
    return this.repository.addPolicy(intelligencePolicySchema.parse(input), actorId, correlationId);
  }

  approvePolicy(id: string, input: unknown, actorId: string, correlationId: string = randomUUID()) {
    return this.repository.approvePolicy(id, intelligencePolicyApprovalSchema.parse(input), actorId, correlationId);
  }
}
