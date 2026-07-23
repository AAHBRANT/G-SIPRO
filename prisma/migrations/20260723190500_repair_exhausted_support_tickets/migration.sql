WITH exhausted AS (
  UPDATE "support_tickets"
  SET
    "status" = 'ESCALATED',
    "escalatedAt" = COALESCE("escalatedAt", CURRENT_TIMESTAMP),
    "executionLeaseId" = NULL,
    "executorId" = NULL,
    "executionClaimedAt" = NULL,
    "executionHeartbeatAt" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "status" IN ('TRIAGED', 'APPROVED')
    AND "executionAttempts" >= 3
  RETURNING "id"
)
INSERT INTO "support_ticket_updates" (
  "id", "ticketId", "fromStatus", "toStatus", "note", "createdById", "actorLabel"
)
SELECT
  gen_random_uuid(),
  "id",
  NULL,
  'ESCALATED',
  'A inconsistência da fila foi corrigida: após três tentativas sem solução, o chamado foi encaminhado ao proprietário em vez de permanecer parado.',
  NULL,
  'Política automática do suporte'
FROM exhausted;
