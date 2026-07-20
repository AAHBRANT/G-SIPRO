import { randomUUID } from "node:crypto";
import { z } from "zod";

const auditEventSchema = z.object({
  id: z.uuid(),
  occurredAt: z.date(),
  actorType: z.enum(["USER", "APPLICATION", "SYSTEM"]),
  actorId: z.string().trim().min(1).max(160),
  action: z.string().trim().min(1).max(120),
  entityType: z.string().trim().min(1).max(120),
  entityId: z.string().trim().min(1).max(160).optional(),
  correlationId: z.uuid(),
  outcome: z.enum(["SUCCESS", "FAILURE", "DENIED"]),
  origin: z.string().trim().min(1).max(160),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AuditEvent = Readonly<z.infer<typeof auditEventSchema>>;
export type NewAuditEvent = Omit<AuditEvent, "id" | "occurredAt"> & Partial<Pick<AuditEvent, "id" | "occurredAt">>;

export function createAuditEvent(input: NewAuditEvent): AuditEvent {
  return Object.freeze(
    auditEventSchema.parse({
      ...input,
      id: input.id ?? randomUUID(),
      occurredAt: input.occurredAt ?? new Date(),
    }),
  );
}

export interface AuditSink {
  append(event: AuditEvent): Promise<void>;
}
