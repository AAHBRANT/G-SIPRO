-- Buscador G-SIPRO (APP-MOD-201) — parte 2 de 2: filtros, varreduras e fila.
-- A origem BUSCADOR é criada na migration anterior (20260728195900).

CREATE TYPE "ScoutRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "ScoutRunTrigger" AS ENUM ('SCHEDULED', 'MANUAL');
CREATE TYPE "ScoutedTenderStatus" AS ENUM ('PENDING', 'APPROVED', 'DISCARDED', 'EXPIRED');

CREATE TABLE "scout_filters" (
    "id" UUID NOT NULL,
    "includeKeywords" TEXT[],
    "excludeKeywords" TEXT[],
    "workTypes" TEXT[],
    "states" TEXT[],
    "spheres" TEXT[],
    "minimumValue" DECIMAL(19,4),
    "maximumValue" DECIMAL(19,4),
    "minimumDaysToClose" INTEGER NOT NULL DEFAULT 10,
    "includeUndisclosedValue" BOOLEAN NOT NULL DEFAULT true,
    "conditionTreatments" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "scout_filters_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scout_runs" (
    "id" UUID NOT NULL,
    "trigger" "ScoutRunTrigger" NOT NULL DEFAULT 'SCHEDULED',
    "status" "ScoutRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(6),
    "totalFetched" INTEGER NOT NULL DEFAULT 0,
    "totalQualified" INTEGER NOT NULL DEFAULT 0,
    "totalNew" INTEGER NOT NULL DEFAULT 0,
    "failureReason" VARCHAR(1000),

    CONSTRAINT "scout_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scouted_tenders" (
    "id" UUID NOT NULL,
    "externalId" VARCHAR(120) NOT NULL,
    "source" VARCHAR(40) NOT NULL DEFAULT 'PNCP',
    "subject" TEXT NOT NULL,
    "authorityName" VARCHAR(400) NOT NULL,
    "authorityDocument" VARCHAR(20),
    "sphere" VARCHAR(1) NOT NULL,
    "city" VARCHAR(200),
    "state" CHAR(2),
    "modality" VARCHAR(120) NOT NULL,
    "processNumber" VARCHAR(120),
    "estimatedValue" DECIMAL(19,4),
    "valueUndisclosed" BOOLEAN NOT NULL DEFAULT false,
    "proposalOpensAt" TIMESTAMPTZ(6),
    "proposalClosesAt" TIMESTAMPTZ(6),
    "noticeUrl" VARCHAR(600),
    "sourceUrl" VARCHAR(600),
    "status" "ScoutedTenderStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMPTZ(6),
    "decidedById" UUID,
    "decisionReason" VARCHAR(1000),
    "opportunityId" UUID,
    "runId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scouted_tenders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "scouted_tenders_externalId_key" ON "scouted_tenders"("externalId");
CREATE INDEX "scouted_tenders_status_proposalClosesAt_idx" ON "scouted_tenders"("status", "proposalClosesAt");
CREATE INDEX "scouted_tenders_runId_idx" ON "scouted_tenders"("runId");
CREATE INDEX "scouted_tenders_opportunityId_idx" ON "scouted_tenders"("opportunityId");
CREATE INDEX "scout_runs_status_startedAt_idx" ON "scout_runs"("status", "startedAt");

ALTER TABLE "scouted_tenders" ADD CONSTRAINT "scouted_tenders_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scouted_tenders" ADD CONSTRAINT "scouted_tenders_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scouted_tenders" ADD CONSTRAINT "scouted_tenders_runId_fkey" FOREIGN KEY ("runId") REFERENCES "scout_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
