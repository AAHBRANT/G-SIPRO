ALTER TYPE "SupportTicketStatus" ADD VALUE IF NOT EXISTS 'OWNER_ACTION_REQUIRED';

ALTER TABLE "support_tickets"
  ADD COLUMN "externalBlocker" JSONB,
  ADD COLUMN "ownerActionRequiredAt" TIMESTAMPTZ(6);
