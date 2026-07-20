CREATE TYPE "ComplianceItemDecision" AS ENUM ('MEETS','PARTIAL','DOES_NOT_MEET','NOT_APPLICABLE');

CREATE TABLE "compliance_item_assessments" (
  "id" UUID PRIMARY KEY,
  "matrixItemId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "previousAssessmentId" UUID,
  "decision" "ComplianceItemDecision" NOT NULL,
  "justification" TEXT NOT NULL,
  "gapDescription" TEXT,
  "riskDescription" TEXT,
  "impact" TEXT,
  "treatment" TEXT,
  "responsibleId" UUID,
  "dueAt" TIMESTAMPTZ(6),
  "evidenceCount" INTEGER NOT NULL,
  "evidenceSnapshot" JSONB NOT NULL,
  "validatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validatedById" UUID NOT NULL,
  "correlationId" UUID NOT NULL,
  CONSTRAINT "assessment_item_fkey" FOREIGN KEY ("matrixItemId") REFERENCES "compliance_matrix_items"("id") ON DELETE RESTRICT,
  CONSTRAINT "assessment_previous_fkey" FOREIGN KEY ("previousAssessmentId") REFERENCES "compliance_item_assessments"("id") ON DELETE RESTRICT,
  CONSTRAINT "assessment_responsible_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "assessment_validator_fkey" FOREIGN KEY ("validatedById") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "assessment_version_positive" CHECK ("version" > 0),
  CONSTRAINT "assessment_justification_nonblank" CHECK (length(btrim("justification")) >= 10),
  CONSTRAINT "assessment_evidence_count_nonnegative" CHECK ("evidenceCount" >= 0),
  CONSTRAINT "assessment_evidence_snapshot_array" CHECK (jsonb_typeof("evidenceSnapshot") = 'array' AND jsonb_array_length("evidenceSnapshot") = "evidenceCount"),
  CONSTRAINT "assessment_treatment_bundle" CHECK (
    ("gapDescription" IS NULL AND "riskDescription" IS NULL AND "impact" IS NULL AND "treatment" IS NULL AND "responsibleId" IS NULL AND "dueAt" IS NULL)
    OR
    (length(btrim("gapDescription")) >= 10 AND length(btrim("riskDescription")) >= 10 AND length(btrim("impact")) >= 10 AND length(btrim("treatment")) >= 10 AND "responsibleId" IS NOT NULL AND "dueAt" IS NOT NULL)
  ),
  CONSTRAINT "assessment_negative_requires_treatment" CHECK ("decision" NOT IN ('PARTIAL','DOES_NOT_MEET') OR "gapDescription" IS NOT NULL),
  CONSTRAINT "assessment_item_version_key" UNIQUE ("matrixItemId","version")
);
CREATE INDEX "assessment_previous_idx" ON "compliance_item_assessments"("previousAssessmentId");
CREATE INDEX "assessment_responsible_due_idx" ON "compliance_item_assessments"("responsibleId","dueAt");
CREATE INDEX "assessment_validator_date_idx" ON "compliance_item_assessments"("validatedById","validatedAt");
CREATE INDEX "assessment_correlation_idx" ON "compliance_item_assessments"("correlationId");

CREATE FUNCTION "enforce_compliance_item_assessment"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE matrix_status "ComplianceMatrixStatus"; current_evidence_count INTEGER; expected_snapshot JSONB; latest RECORD; responsible_status "UserStatus";
BEGIN
  SELECT matrix."status" INTO matrix_status FROM "compliance_matrix_items" item JOIN "compliance_matrices" matrix ON matrix."id"=item."matrixId" WHERE item."id"=NEW."matrixItemId";
  IF matrix_status <> 'IN_ANALYSIS' THEN RAISE EXCEPTION 'item can only be validated while matrix is in analysis'; END IF;

  SELECT count(*)::integer, COALESCE(jsonb_agg(jsonb_build_object('associationId',evidence."id",'technicalEvidenceId',evidence."technicalEvidenceId",'fileHash',evidence."evidenceFileHash") ORDER BY evidence."createdAt",evidence."id"),'[]'::jsonb)
    INTO current_evidence_count, expected_snapshot FROM "compliance_matrix_evidence" evidence WHERE evidence."matrixItemId"=NEW."matrixItemId";
  IF NEW."evidenceCount" <> current_evidence_count OR NEW."evidenceSnapshot" <> expected_snapshot THEN RAISE EXCEPTION 'assessment must snapshot all current evidence'; END IF;
  IF NEW."decision" IN ('MEETS','PARTIAL') AND current_evidence_count = 0 THEN RAISE EXCEPTION 'positive assessment requires evidence'; END IF;

  SELECT "id","version" INTO latest FROM "compliance_item_assessments" WHERE "matrixItemId"=NEW."matrixItemId" ORDER BY "version" DESC LIMIT 1;
  IF latest."id" IS NULL THEN
    IF NEW."version" <> 1 OR NEW."previousAssessmentId" IS NOT NULL THEN RAISE EXCEPTION 'first assessment must be version 1 without predecessor'; END IF;
  ELSIF NEW."version" <> latest."version" + 1 OR NEW."previousAssessmentId" <> latest."id" THEN
    RAISE EXCEPTION 'assessment must create the next version from the latest validation';
  END IF;

  IF NEW."responsibleId" IS NOT NULL THEN
    SELECT "status" INTO responsible_status FROM "users" WHERE "id"=NEW."responsibleId";
    IF responsible_status <> 'ACTIVE' THEN RAISE EXCEPTION 'assessment responsible must be active'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "compliance_item_assessment_guard" BEFORE INSERT ON "compliance_item_assessments" FOR EACH ROW EXECUTE FUNCTION "enforce_compliance_item_assessment"();

CREATE FUNCTION "reject_compliance_item_assessment_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'compliance item assessments are append-only'; END $$;
CREATE TRIGGER "compliance_item_assessment_append_only" BEFORE UPDATE OR DELETE ON "compliance_item_assessments" FOR EACH ROW EXECUTE FUNCTION "reject_compliance_item_assessment_mutation"();

