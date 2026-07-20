-- I1 / BL-104 - Requisitos vinculados à versão documental e ao localizador de origem.
CREATE TYPE "RequirementCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "RequirementStatus" AS ENUM ('DRAFT', 'PENDING_VALIDATION', 'VALIDATED', 'REJECTED');

CREATE TABLE "tender_requirements" (
  "id" UUID NOT NULL, "tenderVersionId" UUID NOT NULL, "type" VARCHAR(80) NOT NULL,
  "text" TEXT NOT NULL, "criticality" "RequirementCriticality" NOT NULL, "responsibleId" UUID NOT NULL,
  "sourceExcerpt" TEXT NOT NULL, "sourcePage" INTEGER NOT NULL,
  "status" "RequirementStatus" NOT NULL DEFAULT 'DRAFT', "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdBy" UUID NOT NULL,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL, "updatedBy" UUID NOT NULL,
  CONSTRAINT "tender_requirements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tender_requirements_sourcePage_check" CHECK ("sourcePage" > 0)
);

CREATE TABLE "requirement_history" (
  "id" UUID NOT NULL, "requirementId" UUID NOT NULL, "version" INTEGER NOT NULL,
  "action" VARCHAR(80) NOT NULL, "changes" JSONB NOT NULL,
  "changedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "changedById" UUID NOT NULL,
  "correlationId" UUID NOT NULL, CONSTRAINT "requirement_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tender_requirements_tenderVersionId_criticality_status_idx" ON "tender_requirements"("tenderVersionId", "criticality", "status");
CREATE INDEX "tender_requirements_responsibleId_status_idx" ON "tender_requirements"("responsibleId", "status");
CREATE INDEX "requirement_history_changedById_changedAt_idx" ON "requirement_history"("changedById", "changedAt");
CREATE INDEX "requirement_history_correlationId_idx" ON "requirement_history"("correlationId");
CREATE UNIQUE INDEX "requirement_history_requirementId_version_key" ON "requirement_history"("requirementId", "version");

ALTER TABLE "tender_requirements" ADD CONSTRAINT "tender_requirements_tenderVersionId_fkey" FOREIGN KEY ("tenderVersionId") REFERENCES "tender_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tender_requirements" ADD CONSTRAINT "tender_requirements_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "requirement_history" ADD CONSTRAINT "requirement_history_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "tender_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "requirement_history" ADD CONSTRAINT "requirement_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_requirement_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'requirement_history is append-only'; END;
$$;
CREATE TRIGGER requirement_history_append_only BEFORE UPDATE OR DELETE ON "requirement_history" FOR EACH ROW EXECUTE FUNCTION prevent_requirement_history_mutation();
COMMENT ON TABLE "requirement_history" IS 'GSIPRO-FUN-103: histórico imutável de requisitos vinculados à evidência documental.';
