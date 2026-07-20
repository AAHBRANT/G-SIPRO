-- GSIPRO I1 / BL-101 - Cadastro e ciclo de vida de oportunidades
CREATE TYPE "OpportunityOrigin" AS ENUM ('CHANNEL', 'REFERRAL', 'PORTAL', 'CUSTOMER', 'PROSPECTING');

CREATE TYPE "OpportunityStatus" AS ENUM ('DRAFT', 'QUALIFICATION', 'ACTIVE', 'SUSPENDED', 'CLOSED');

CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "identifiers" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,
    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contracting_authorities" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "sphere" VARCHAR(80),
    "locality" VARCHAR(160),
    "identifiers" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,
    CONSTRAINT "contracting_authorities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "opportunities" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "origin" "OpportunityOrigin" NOT NULL,
    "subject" TEXT,
    "customerId" UUID,
    "contractingAuthorityId" UUID,
    "estimatedValue" DECIMAL(19,4),
    "currency" CHAR(3),
    "valueSource" VARCHAR(300),
    "publishedAt" TIMESTAMPTZ(6),
    "deliveryAt" TIMESTAMPTZ(6),
    "datesSource" VARCHAR(300),
    "datesTimeZone" VARCHAR(80),
    "ownerId" UUID,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'DRAFT',
    "closureReasonCode" VARCHAR(80),
    "closureJustification" VARCHAR(1000),
    "closedAt" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,
    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "opportunity_history" (
    "id" UUID NOT NULL,
    "opportunityId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "fromStatus" "OpportunityStatus",
    "toStatus" "OpportunityStatus" NOT NULL,
    "changes" JSONB NOT NULL,
    "reason" VARCHAR(1000),
    "changedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" UUID NOT NULL,
    "correlationId" UUID NOT NULL,
    CONSTRAINT "opportunity_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customers_name_idx" ON "customers"("name");
CREATE INDEX "customers_active_idx" ON "customers"("active");
CREATE INDEX "contracting_authorities_name_idx" ON "contracting_authorities"("name");
CREATE INDEX "contracting_authorities_active_idx" ON "contracting_authorities"("active");
CREATE UNIQUE INDEX "opportunities_code_key" ON "opportunities"("code");
CREATE INDEX "opportunities_status_deliveryAt_idx" ON "opportunities"("status", "deliveryAt");
CREATE INDEX "opportunities_ownerId_status_idx" ON "opportunities"("ownerId", "status");
CREATE INDEX "opportunities_customerId_status_idx" ON "opportunities"("customerId", "status");
CREATE INDEX "opportunities_contractingAuthorityId_status_idx" ON "opportunities"("contractingAuthorityId", "status");
CREATE INDEX "opportunity_history_changedById_changedAt_idx" ON "opportunity_history"("changedById", "changedAt");
CREATE INDEX "opportunity_history_correlationId_idx" ON "opportunity_history"("correlationId");
CREATE UNIQUE INDEX "opportunity_history_opportunityId_version_key" ON "opportunity_history"("opportunityId", "version");

ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_contractingAuthorityId_fkey" FOREIGN KEY ("contractingAuthorityId") REFERENCES "contracting_authorities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opportunity_history" ADD CONSTRAINT "opportunity_history_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opportunity_history" ADD CONSTRAINT "opportunity_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Histórico crítico é append-only: nenhuma UPDATE ou DELETE é aceita pelo banco.
CREATE OR REPLACE FUNCTION prevent_opportunity_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'opportunity_history is append-only';
END;
$$;

CREATE TRIGGER opportunity_history_append_only
BEFORE UPDATE OR DELETE ON "opportunity_history"
FOR EACH ROW
EXECUTE FUNCTION prevent_opportunity_history_mutation();

COMMENT ON TABLE "opportunity_history" IS
'GSIPRO-FUN-101: histórico imutável das alterações críticas e transições de oportunidade.';
