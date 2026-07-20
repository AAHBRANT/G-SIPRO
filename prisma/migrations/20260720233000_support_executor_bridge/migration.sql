ALTER TABLE "support_tickets"
  ADD COLUMN "executionLeaseId" UUID,
  ADD COLUMN "executorId" VARCHAR(160),
  ADD COLUMN "executionClaimedAt" TIMESTAMPTZ(6),
  ADD COLUMN "executionHeartbeatAt" TIMESTAMPTZ(6),
  ADD COLUMN "executionAttempts" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "support_tickets_executionLeaseId_key"
  ON "support_tickets"("executionLeaseId");

ALTER TABLE "support_ticket_updates"
  ALTER COLUMN "createdById" DROP NOT NULL,
  ADD COLUMN "actorLabel" VARCHAR(160) NOT NULL DEFAULT 'Usuário';

UPDATE "support_ticket_updates" AS update
SET "actorLabel" = COALESCE("users"."displayName", 'Usuário')
FROM "users"
WHERE update."createdById" = "users"."id";
