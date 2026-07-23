WITH migrated AS (
  UPDATE "support_tickets"
  SET
    "status" = 'WAITING_APPROVAL',
    "approvalRequired" = TRUE,
    "approvalReason" = CASE
      WHEN "type" = 'NEW_FEATURE' THEN 'Nova ferramenta ou capacidade: exige aprovação do proprietário antes da execução automática.'
      ELSE 'Melhoria ou alteração funcional: exige aprovação do proprietário antes da execução automática.'
    END,
    "executionAttempts" = 0,
    "executorId" = NULL,
    "executionClaimedAt" = NULL,
    "executionHeartbeatAt" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "type" IN ('IMPROVEMENT', 'NEW_FEATURE')
    AND "status" = 'TRIAGED'
    AND "executionLeaseId" IS NULL
  RETURNING "id"
)
INSERT INTO "support_ticket_updates" (
  "id", "ticketId", "fromStatus", "toStatus", "note", "createdById", "actorLabel"
)
SELECT
  gen_random_uuid(),
  "id",
  'TRIAGED',
  'WAITING_APPROVAL',
  'Solicitação encaminhada ao proprietário para aprovação antes da execução automática.',
  NULL,
  'Política de suporte'
FROM migrated;
