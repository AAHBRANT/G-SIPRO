CREATE TYPE "ProfessionalStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'RESTRICTED');
CREATE TYPE "ProfessionalLinkTargetType" AS ENUM ('CONTRACT', 'WORK', 'TECHNICAL_EVIDENCE');

CREATE TABLE "professionals" (
  "id" UUID NOT NULL,
  "fullName" VARCHAR(255) NOT NULL,
  "council" VARCHAR(40) NOT NULL,
  "registrationNumber" VARCHAR(100) NOT NULL,
  "nationalRegistration" VARCHAR(100),
  "professionalTitle" VARCHAR(160) NOT NULL,
  "status" "ProfessionalStatus" NOT NULL DEFAULT 'ACTIVE',
  "processingPurpose" VARCHAR(500) NOT NULL,
  "legalBasis" VARCHAR(255) NOT NULL,
  "classification" VARCHAR(80) NOT NULL DEFAULT 'PERSONAL_DATA',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" UUID NOT NULL,
  CONSTRAINT "professionals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "professionals_version_positive" CHECK ("version" > 0),
  CONSTRAINT "professionals_personal_classification" CHECK ("classification" = 'PERSONAL_DATA')
);

CREATE TABLE "professional_links" (
  "id" UUID NOT NULL,
  "professionalId" UUID NOT NULL,
  "targetType" "ProfessionalLinkTargetType" NOT NULL,
  "contractId" UUID,
  "workId" UUID,
  "technicalEvidenceId" UUID,
  "role" VARCHAR(160) NOT NULL,
  "responsibility" TEXT NOT NULL,
  "startedAt" DATE NOT NULL,
  "endedAt" DATE NOT NULL,
  "source" VARCHAR(500) NOT NULL,
  "evidenceDocumentVersionId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" UUID NOT NULL,
  "correlationId" UUID NOT NULL,
  CONSTRAINT "professional_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "professional_links_period_order" CHECK ("endedAt" >= "startedAt"),
  CONSTRAINT "professional_links_one_target" CHECK (num_nonnulls("contractId", "workId", "technicalEvidenceId") = 1),
  CONSTRAINT "professional_links_target_match" CHECK (
    ("targetType" = 'CONTRACT' AND "contractId" IS NOT NULL) OR
    ("targetType" = 'WORK' AND "workId" IS NOT NULL) OR
    ("targetType" = 'TECHNICAL_EVIDENCE' AND "technicalEvidenceId" IS NOT NULL)
  )
);

CREATE TABLE "professional_history" (
  "id" UUID NOT NULL,
  "professionalId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "action" VARCHAR(80) NOT NULL,
  "snapshot" JSONB NOT NULL,
  "changedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changedById" UUID NOT NULL,
  "correlationId" UUID NOT NULL,
  CONSTRAINT "professional_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "professional_history_version_positive" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "professionals_council_registrationNumber_key" ON "professionals"("council", "registrationNumber");
CREATE INDEX "professionals_fullName_idx" ON "professionals"("fullName");
CREATE INDEX "professionals_status_council_idx" ON "professionals"("status", "council");
CREATE UNIQUE INDEX "professional_links_professionalId_contractId_role_startedAt_key" ON "professional_links"("professionalId", "contractId", "role", "startedAt");
CREATE UNIQUE INDEX "professional_links_professionalId_workId_role_startedAt_key" ON "professional_links"("professionalId", "workId", "role", "startedAt");
CREATE UNIQUE INDEX "professional_links_professionalId_technicalEvidenceId_role_startedAt_key" ON "professional_links"("professionalId", "technicalEvidenceId", "role", "startedAt");
CREATE INDEX "professional_links_contractId_idx" ON "professional_links"("contractId");
CREATE INDEX "professional_links_workId_idx" ON "professional_links"("workId");
CREATE INDEX "professional_links_technicalEvidenceId_idx" ON "professional_links"("technicalEvidenceId");
CREATE INDEX "professional_links_evidenceDocumentVersionId_idx" ON "professional_links"("evidenceDocumentVersionId");
CREATE INDEX "professional_links_createdById_createdAt_idx" ON "professional_links"("createdById", "createdAt");
CREATE UNIQUE INDEX "professional_history_professionalId_version_key" ON "professional_history"("professionalId", "version");
CREATE INDEX "professional_history_changedById_changedAt_idx" ON "professional_history"("changedById", "changedAt");
CREATE INDEX "professional_history_correlationId_idx" ON "professional_history"("correlationId");

ALTER TABLE "professionals" ADD CONSTRAINT "professionals_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "professional_links" ADD CONSTRAINT "professional_links_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professionals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "professional_links" ADD CONSTRAINT "professional_links_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "executed_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "professional_links" ADD CONSTRAINT "professional_links_workId_fkey" FOREIGN KEY ("workId") REFERENCES "executed_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "professional_links" ADD CONSTRAINT "professional_links_technicalEvidenceId_fkey" FOREIGN KEY ("technicalEvidenceId") REFERENCES "technical_evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "professional_links" ADD CONSTRAINT "professional_links_evidenceDocumentVersionId_fkey" FOREIGN KEY ("evidenceDocumentVersionId") REFERENCES "managed_document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "professional_links" ADD CONSTRAINT "professional_links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "professional_history" ADD CONSTRAINT "professional_history_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professionals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "professional_history" ADD CONSTRAINT "professional_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION enforce_professional_link_integrity() RETURNS trigger AS $$
DECLARE target_start DATE;
DECLARE target_end DATE;
DECLARE evidence_type "TechnicalEvidenceType";
BEGIN
  IF NEW."targetType" = 'CONTRACT' THEN
    SELECT "startedAt", "endedAt" INTO target_start, target_end FROM "executed_contracts" WHERE "id" = NEW."contractId";
  ELSIF NEW."targetType" = 'WORK' THEN
    SELECT "startedAt", "endedAt" INTO target_start, target_end FROM "executed_works" WHERE "id" = NEW."workId";
  ELSE
    SELECT "startedAt", "endedAt", "type" INTO target_start, target_end, evidence_type FROM "technical_evidence" WHERE "id" = NEW."technicalEvidenceId";
    IF evidence_type NOT IN ('CAT', 'ART') THEN RAISE EXCEPTION 'professional link accepts only CAT or ART technical evidence'; END IF;
  END IF;
  IF target_start IS NULL OR target_end IS NULL THEN RAISE EXCEPTION 'professional link target or target period not found'; END IF;
  IF NEW."startedAt" < target_start OR NEW."endedAt" > target_end THEN RAISE EXCEPTION 'professional link period must be contained in target period'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION prevent_professional_evidence_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'professional links and history are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "professional_link_integrity" BEFORE INSERT ON "professional_links" FOR EACH ROW EXECUTE FUNCTION enforce_professional_link_integrity();
CREATE TRIGGER "professional_links_append_only" BEFORE UPDATE OR DELETE ON "professional_links" FOR EACH ROW EXECUTE FUNCTION prevent_professional_evidence_mutation();
CREATE TRIGGER "professional_history_append_only" BEFORE UPDATE OR DELETE ON "professional_history" FOR EACH ROW EXECUTE FUNCTION prevent_professional_evidence_mutation();
