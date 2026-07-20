CREATE TYPE "SupportTicketType" AS ENUM ('BUG', 'QUESTION', 'IMPROVEMENT', 'NEW_FEATURE');
CREATE TYPE "SupportTicketPriority" AS ENUM ('NORMAL', 'HIGH', 'CRITICAL');
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'TRIAGED', 'WAITING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "SupportDecision" AS ENUM ('APPROVED', 'REJECTED');

CREATE TABLE "support_tickets" (
  "id" UUID NOT NULL,
  "number" SERIAL NOT NULL,
  "type" "SupportTicketType" NOT NULL,
  "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT NOT NULL,
  "pagePath" VARCHAR(500),
  "errorMessage" TEXT,
  "stepsToReproduce" TEXT,
  "clientContext" JSONB,
  "aiDiagnosis" JSONB,
  "aiProviderModel" VARCHAR(160),
  "aiDiagnosedAt" TIMESTAMPTZ(6),
  "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
  "approvalReason" VARCHAR(1000),
  "reporterId" UUID NOT NULL,
  "assignedToId" UUID,
  "resolution" TEXT,
  "resolvedAt" TIMESTAMPTZ(6),
  "resolvedById" UUID,
  "correlationId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_tickets_number_key" UNIQUE ("number"),
  CONSTRAINT "support_tickets_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "support_tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "support_tickets_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE TABLE "support_ticket_attachments" (
  "id" UUID NOT NULL,
  "ticketId" UUID NOT NULL,
  "fileName" VARCHAR(255) NOT NULL,
  "fileHash" CHAR(64) NOT NULL,
  "mimeType" VARCHAR(160) NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "uri" VARCHAR(1000) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" UUID NOT NULL,
  CONSTRAINT "support_ticket_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_ticket_attachments_ticketId_fileHash_key" UNIQUE ("ticketId", "fileHash"),
  CONSTRAINT "support_ticket_attachments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE RESTRICT
);

CREATE TABLE "support_ticket_decisions" (
  "id" UUID NOT NULL,
  "ticketId" UUID NOT NULL,
  "decision" "SupportDecision" NOT NULL,
  "note" VARCHAR(1000) NOT NULL,
  "decidedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedById" UUID NOT NULL,
  CONSTRAINT "support_ticket_decisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_ticket_decisions_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE RESTRICT,
  CONSTRAINT "support_ticket_decisions_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE TABLE "support_ticket_updates" (
  "id" UUID NOT NULL,
  "ticketId" UUID NOT NULL,
  "fromStatus" "SupportTicketStatus",
  "toStatus" "SupportTicketStatus" NOT NULL,
  "note" VARCHAR(2000) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" UUID NOT NULL,
  CONSTRAINT "support_ticket_updates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_ticket_updates_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE RESTRICT,
  CONSTRAINT "support_ticket_updates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX "support_tickets_status_priority_createdAt_idx" ON "support_tickets"("status", "priority", "createdAt");
CREATE INDEX "support_tickets_reporterId_createdAt_idx" ON "support_tickets"("reporterId", "createdAt");
CREATE INDEX "support_tickets_approvalRequired_status_idx" ON "support_tickets"("approvalRequired", "status");
CREATE INDEX "support_tickets_correlationId_idx" ON "support_tickets"("correlationId");
CREATE INDEX "support_ticket_attachments_fileHash_idx" ON "support_ticket_attachments"("fileHash");
CREATE INDEX "support_ticket_decisions_ticketId_decidedAt_idx" ON "support_ticket_decisions"("ticketId", "decidedAt");
CREATE INDEX "support_ticket_decisions_decidedById_decidedAt_idx" ON "support_ticket_decisions"("decidedById", "decidedAt");
CREATE INDEX "support_ticket_updates_ticketId_createdAt_idx" ON "support_ticket_updates"("ticketId", "createdAt");
CREATE INDEX "support_ticket_updates_createdById_createdAt_idx" ON "support_ticket_updates"("createdById", "createdAt");
