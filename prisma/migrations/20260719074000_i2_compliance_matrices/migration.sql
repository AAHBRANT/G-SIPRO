CREATE TYPE "ComplianceMatrixStatus" AS ENUM ('IN_ANALYSIS','VALIDATED','SUPERSEDED');

CREATE TABLE "compliance_matrices" (
  "id" UUID PRIMARY KEY,
  "tenderVersionId" UUID NOT NULL,
  "analysisReference" VARCHAR(160) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "ComplianceMatrixStatus" NOT NULL DEFAULT 'IN_ANALYSIS',
  "sourceFileHash" CHAR(64) NOT NULL,
  "itemCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" UUID NOT NULL,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "updatedBy" UUID NOT NULL,
  CONSTRAINT "compliance_matrices_tenderVersionId_fkey" FOREIGN KEY ("tenderVersionId") REFERENCES "tender_versions"("id") ON DELETE RESTRICT,
  CONSTRAINT "compliance_matrices_positive_version" CHECK ("version" > 0),
  CONSTRAINT "compliance_matrices_positive_item_count" CHECK ("itemCount" > 0),
  CONSTRAINT "compliance_matrices_source_hash_format" CHECK ("sourceFileHash" ~ '^[0-9A-Fa-f]{64}$'),
  CONSTRAINT "compliance_matrices_tenderVersionId_analysisReference_version_key" UNIQUE ("tenderVersionId","analysisReference","version")
);
CREATE INDEX "compliance_matrices_tenderVersionId_status_idx" ON "compliance_matrices"("tenderVersionId","status");

CREATE TABLE "compliance_matrix_items" (
  "id" UUID PRIMARY KEY,
  "matrixId" UUID NOT NULL,
  "requirementId" UUID NOT NULL,
  "requirementVersion" INTEGER NOT NULL,
  "requirementType" VARCHAR(80) NOT NULL,
  "requirementText" TEXT NOT NULL,
  "criticality" "RequirementCriticality" NOT NULL,
  "sourceExcerpt" TEXT NOT NULL,
  "sourcePage" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" UUID NOT NULL,
  CONSTRAINT "compliance_matrix_items_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "compliance_matrices"("id") ON DELETE RESTRICT,
  CONSTRAINT "compliance_matrix_items_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "tender_requirements"("id") ON DELETE RESTRICT,
  CONSTRAINT "compliance_matrix_items_positive_version" CHECK ("requirementVersion" > 0),
  CONSTRAINT "compliance_matrix_items_positive_page" CHECK ("sourcePage" > 0),
  CONSTRAINT "compliance_matrix_items_matrixId_requirementId_key" UNIQUE ("matrixId","requirementId")
);
CREATE INDEX "compliance_matrix_items_requirementId_idx" ON "compliance_matrix_items"("requirementId");
CREATE INDEX "compliance_matrix_items_matrixId_criticality_idx" ON "compliance_matrix_items"("matrixId","criticality");

CREATE TABLE "compliance_matrix_history" (
  "id" UUID PRIMARY KEY,
  "matrixId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "action" VARCHAR(80) NOT NULL,
  "snapshot" JSONB NOT NULL,
  "changedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changedById" UUID NOT NULL,
  "correlationId" UUID NOT NULL,
  CONSTRAINT "compliance_matrix_history_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "compliance_matrices"("id") ON DELETE RESTRICT,
  CONSTRAINT "compliance_matrix_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "compliance_matrix_history_matrixId_version_key" UNIQUE ("matrixId","version")
);
CREATE INDEX "compliance_matrix_history_changedById_changedAt_idx" ON "compliance_matrix_history"("changedById","changedAt");
CREATE INDEX "compliance_matrix_history_correlationId_idx" ON "compliance_matrix_history"("correlationId");

CREATE FUNCTION "enforce_compliance_matrix_item_origin"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE requirement_record RECORD; matrix_tender_version UUID;
BEGIN
  SELECT "tenderVersionId" INTO matrix_tender_version FROM "compliance_matrices" WHERE "id"=NEW."matrixId";
  SELECT "tenderVersionId","status","version" INTO requirement_record FROM "tender_requirements" WHERE "id"=NEW."requirementId";
  IF requirement_record."status" <> 'VALIDATED' THEN RAISE EXCEPTION 'matrix items require validated requirements'; END IF;
  IF requirement_record."tenderVersionId" <> matrix_tender_version THEN RAISE EXCEPTION 'matrix item requirement must belong to matrix tender version'; END IF;
  IF requirement_record."version" <> NEW."requirementVersion" THEN RAISE EXCEPTION 'matrix item must snapshot the current validated requirement version'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "compliance_matrix_item_origin_guard" BEFORE INSERT ON "compliance_matrix_items" FOR EACH ROW EXECUTE FUNCTION "enforce_compliance_matrix_item_origin"();

CREATE FUNCTION "reject_compliance_matrix_snapshot_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'compliance matrix items and history are append-only'; END $$;
CREATE TRIGGER "compliance_matrix_items_append_only" BEFORE UPDATE OR DELETE ON "compliance_matrix_items" FOR EACH ROW EXECUTE FUNCTION "reject_compliance_matrix_snapshot_mutation"();
CREATE TRIGGER "compliance_matrix_history_append_only" BEFORE UPDATE OR DELETE ON "compliance_matrix_history" FOR EACH ROW EXECUTE FUNCTION "reject_compliance_matrix_snapshot_mutation"();

