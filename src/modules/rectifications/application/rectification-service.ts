import { randomUUID } from "node:crypto";
import { rectificationSchema, type RectificationDraft } from "@/modules/rectifications/domain/rectification";
export type RectificationRecord = Readonly<{ id: string; tenderId: string; previousVersionId: string; rectifiedByVersionId: string; impacts: number; reopenedAnalyses: number }>;
export interface RectificationRepository { create(draft: RectificationDraft, actorId: string, correlationId: string): Promise<RectificationRecord>; }
export class RectificationRuleError extends Error { constructor(message: string) { super(message); this.name = "RectificationRuleError"; } }
export class RectificationService { constructor(private readonly repository: RectificationRepository) {} create(input: unknown, actorId: string, correlationId: string = randomUUID()) { return this.repository.create(rectificationSchema.parse(input), actorId, correlationId); } }
