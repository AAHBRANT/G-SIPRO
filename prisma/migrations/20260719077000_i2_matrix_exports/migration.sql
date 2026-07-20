CREATE TABLE "compliance_matrix_exports" (
  "id" UUID PRIMARY KEY,
  "matrixId" UUID NOT NULL,
  "matrixVersion" INTEGER NOT NULL,
  "format" VARCHAR(20) NOT NULL,
  "fileName" VARCHAR(255) NOT NULL,
  "fileHash" CHAR(64) NOT NULL,
  "payload" JSONB NOT NULL,
  "exportedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "exportedById" UUID NOT NULL,
  "correlationId" UUID NOT NULL,
  CONSTRAINT "matrix_export_matrix_fkey" FOREIGN KEY ("matrixId") REFERENCES "compliance_matrices"("id") ON DELETE RESTRICT,
  CONSTRAINT "matrix_export_user_fkey" FOREIGN KEY ("exportedById") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "matrix_export_version_positive" CHECK ("matrixVersion" > 0),
  CONSTRAINT "matrix_export_format_json" CHECK ("format" = 'JSON'),
  CONSTRAINT "matrix_export_name_nonblank" CHECK (length(btrim("fileName")) > 5),
  CONSTRAINT "matrix_export_hash_sha256" CHECK ("fileHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "matrix_export_payload_object" CHECK (jsonb_typeof("payload") = 'object'),
  CONSTRAINT "matrix_export_unique" UNIQUE ("matrixId","matrixVersion","format")
);
CREATE INDEX "matrix_export_hash_idx" ON "compliance_matrix_exports"("fileHash");
CREATE INDEX "matrix_export_user_date_idx" ON "compliance_matrix_exports"("exportedById","exportedAt");
CREATE INDEX "matrix_export_correlation_idx" ON "compliance_matrix_exports"("correlationId");

CREATE FUNCTION "enforce_compliance_matrix_export"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE matrix_record RECORD;
BEGIN
  SELECT "version","status","sourceFileHash" INTO matrix_record FROM "compliance_matrices" WHERE "id"=NEW."matrixId";
  IF matrix_record."status" <> 'VALIDATED' THEN RAISE EXCEPTION 'only validated matrices can be exported'; END IF;
  IF matrix_record."version" <> NEW."matrixVersion" THEN RAISE EXCEPTION 'export must preserve the current matrix version'; END IF;
  IF NEW."payload" #>> '{matrix,id}' <> NEW."matrixId"::text OR (NEW."payload" #>> '{matrix,version}')::integer <> NEW."matrixVersion" THEN RAISE EXCEPTION 'export payload must identify its matrix and version'; END IF;
  IF NEW."payload" #>> '{source,fileHash}' <> matrix_record."sourceFileHash" THEN RAISE EXCEPTION 'export payload must preserve the matrix source hash'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "compliance_matrix_export_guard" BEFORE INSERT ON "compliance_matrix_exports" FOR EACH ROW EXECUTE FUNCTION "enforce_compliance_matrix_export"();

CREATE FUNCTION "guard_compliance_matrix_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."tenderVersionId" <> NEW."tenderVersionId" OR OLD."analysisReference" <> NEW."analysisReference" OR OLD."version" <> NEW."version" OR OLD."sourceFileHash" <> NEW."sourceFileHash" OR OLD."itemCount" <> NEW."itemCount" OR OLD."createdAt" <> NEW."createdAt" OR OLD."createdBy" <> NEW."createdBy" THEN RAISE EXCEPTION 'compliance matrix identity and source are immutable'; END IF;
  IF OLD."status" <> 'IN_ANALYSIS' OR NEW."status" <> 'VALIDATED' THEN RAISE EXCEPTION 'only transition from analysis to validated is allowed'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "compliance_matrix_update_guard" BEFORE UPDATE ON "compliance_matrices" FOR EACH ROW EXECUTE FUNCTION "guard_compliance_matrix_update"();

CREATE FUNCTION "reject_compliance_matrix_export_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'compliance matrix exports are append-only'; END $$;
CREATE TRIGGER "compliance_matrix_export_append_only" BEFORE UPDATE OR DELETE ON "compliance_matrix_exports" FOR EACH ROW EXECUTE FUNCTION "reject_compliance_matrix_export_mutation"();

