CREATE TABLE "compliance_matrix_evidence" (
  "id" UUID PRIMARY KEY,
  "matrixItemId" UUID NOT NULL,
  "technicalEvidenceId" UUID NOT NULL,
  "evidenceDocumentVersionId" UUID NOT NULL,
  "evidenceFileHash" CHAR(64) NOT NULL,
  "locator" VARCHAR(500) NOT NULL,
  "justification" VARCHAR(1000) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" UUID NOT NULL,
  "correlationId" UUID NOT NULL,
  CONSTRAINT "matrix_evidence_item_fkey" FOREIGN KEY ("matrixItemId") REFERENCES "compliance_matrix_items"("id") ON DELETE RESTRICT,
  CONSTRAINT "matrix_evidence_technical_fkey" FOREIGN KEY ("technicalEvidenceId") REFERENCES "technical_evidence"("id") ON DELETE RESTRICT,
  CONSTRAINT "matrix_evidence_document_version_fkey" FOREIGN KEY ("evidenceDocumentVersionId") REFERENCES "managed_document_versions"("id") ON DELETE RESTRICT,
  CONSTRAINT "matrix_evidence_hash_format" CHECK ("evidenceFileHash" ~ '^[0-9A-Fa-f]{64}$'),
  CONSTRAINT "matrix_evidence_locator_nonblank" CHECK (length(btrim("locator")) > 0),
  CONSTRAINT "matrix_evidence_justification_nonblank" CHECK (length(btrim("justification")) >= 10),
  CONSTRAINT "matrix_evidence_item_technical_key" UNIQUE ("matrixItemId","technicalEvidenceId")
);
CREATE INDEX "matrix_evidence_technical_idx" ON "compliance_matrix_evidence"("technicalEvidenceId");
CREATE INDEX "matrix_evidence_document_version_idx" ON "compliance_matrix_evidence"("evidenceDocumentVersionId");
CREATE INDEX "matrix_evidence_correlation_idx" ON "compliance_matrix_evidence"("correlationId");

CREATE TABLE "compliance_quantity_comparisons" (
  "id" UUID PRIMARY KEY,
  "evidenceAssociationId" UUID NOT NULL,
  "executedQuantityId" UUID NOT NULL,
  "requiredValue" DECIMAL(19,6) NOT NULL,
  "requiredUnit" VARCHAR(40) NOT NULL,
  "provenValue" DECIMAL(19,6) NOT NULL,
  "provenUnit" VARCHAR(40) NOT NULL,
  "normalizedProvenValue" DECIMAL(19,6) NOT NULL,
  "difference" DECIMAL(19,6) NOT NULL,
  "conversionFactor" DECIMAL(19,9),
  "conversionRule" TEXT,
  "conversionSource" VARCHAR(500),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" UUID NOT NULL,
  "correlationId" UUID NOT NULL,
  CONSTRAINT "quantity_comparison_evidence_fkey" FOREIGN KEY ("evidenceAssociationId") REFERENCES "compliance_matrix_evidence"("id") ON DELETE RESTRICT,
  CONSTRAINT "quantity_comparison_quantity_fkey" FOREIGN KEY ("executedQuantityId") REFERENCES "executed_quantities"("id") ON DELETE RESTRICT,
  CONSTRAINT "quantity_comparison_nonnegative" CHECK ("requiredValue" >= 0 AND "provenValue" >= 0 AND "normalizedProvenValue" >= 0),
  CONSTRAINT "quantity_comparison_units_nonblank" CHECK (length(btrim("requiredUnit")) > 0 AND length(btrim("provenUnit")) > 0),
  CONSTRAINT "quantity_comparison_conversion_complete" CHECK (("conversionFactor" IS NULL AND "conversionRule" IS NULL AND "conversionSource" IS NULL) OR ("conversionFactor" > 0 AND length(btrim("conversionRule")) >= 10 AND length(btrim("conversionSource")) > 0)),
  CONSTRAINT "quantity_comparison_unit_conversion" CHECK ((lower(btrim("requiredUnit")) = lower(btrim("provenUnit")) AND "conversionFactor" IS NULL) OR (lower(btrim("requiredUnit")) <> lower(btrim("provenUnit")) AND "conversionFactor" IS NOT NULL)),
  CONSTRAINT "quantity_comparison_normalization" CHECK ("normalizedProvenValue" = round("provenValue" * COALESCE("conversionFactor",1),6)),
  CONSTRAINT "quantity_comparison_difference" CHECK ("difference" = "normalizedProvenValue" - "requiredValue"),
  CONSTRAINT "quantity_comparison_unique" UNIQUE ("evidenceAssociationId","executedQuantityId","requiredValue","requiredUnit")
);
CREATE INDEX "quantity_comparison_quantity_idx" ON "compliance_quantity_comparisons"("executedQuantityId");
CREATE INDEX "quantity_comparison_correlation_idx" ON "compliance_quantity_comparisons"("correlationId");

CREATE FUNCTION "enforce_matrix_evidence_origin"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE evidence_record RECORD; document_hash CHAR(64); matrix_status "ComplianceMatrixStatus";
BEGIN
  SELECT "documentVersionId" INTO evidence_record FROM "technical_evidence" WHERE "id"=NEW."technicalEvidenceId";
  SELECT "fileHash" INTO document_hash FROM "managed_document_versions" WHERE "id"=NEW."evidenceDocumentVersionId";
  SELECT matrix."status" INTO matrix_status FROM "compliance_matrix_items" item JOIN "compliance_matrices" matrix ON matrix."id"=item."matrixId" WHERE item."id"=NEW."matrixItemId";
  IF evidence_record."documentVersionId" <> NEW."evidenceDocumentVersionId" THEN RAISE EXCEPTION 'matrix evidence must use the technical evidence document version'; END IF;
  IF document_hash <> NEW."evidenceFileHash" THEN RAISE EXCEPTION 'matrix evidence hash must match its document version'; END IF;
  IF matrix_status <> 'IN_ANALYSIS' THEN RAISE EXCEPTION 'evidence can only be associated while matrix is in analysis'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "matrix_evidence_origin_guard" BEFORE INSERT ON "compliance_matrix_evidence" FOR EACH ROW EXECUTE FUNCTION "enforce_matrix_evidence_origin"();

CREATE FUNCTION "enforce_quantity_comparison_origin"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE quantity_record RECORD; evidence_experience UUID;
BEGIN
  SELECT quantity."value",quantity."unit",service."contractId" INTO quantity_record FROM "executed_quantities" quantity JOIN "executed_services" service ON service."id"=quantity."serviceId" WHERE quantity."id"=NEW."executedQuantityId";
  SELECT evidence."experienceId" INTO evidence_experience FROM "compliance_matrix_evidence" association JOIN "technical_evidence" evidence ON evidence."id"=association."technicalEvidenceId" WHERE association."id"=NEW."evidenceAssociationId";
  IF quantity_record."contractId" <> evidence_experience THEN RAISE EXCEPTION 'comparison quantity must belong to the evidence experience'; END IF;
  IF quantity_record."value" <> NEW."provenValue" OR lower(btrim(quantity_record."unit")) <> lower(btrim(NEW."provenUnit")) THEN RAISE EXCEPTION 'comparison must preserve proven quantity and unit'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "quantity_comparison_origin_guard" BEFORE INSERT ON "compliance_quantity_comparisons" FOR EACH ROW EXECUTE FUNCTION "enforce_quantity_comparison_origin"();

CREATE FUNCTION "reject_matrix_evidence_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'matrix evidence and comparisons are append-only'; END $$;
CREATE TRIGGER "matrix_evidence_append_only" BEFORE UPDATE OR DELETE ON "compliance_matrix_evidence" FOR EACH ROW EXECUTE FUNCTION "reject_matrix_evidence_mutation"();
CREATE TRIGGER "quantity_comparison_append_only" BEFORE UPDATE OR DELETE ON "compliance_quantity_comparisons" FOR EACH ROW EXECUTE FUNCTION "reject_matrix_evidence_mutation"();

