CREATE TYPE "TechnicalEvidenceType" AS ENUM ('ATTESTATION', 'CAT', 'ART');
CREATE TYPE "TechnicalEvidenceStatus" AS ENUM ('CURRENT', 'RESTRICTED', 'EXPIRED');

CREATE TABLE "technical_evidence" (
  "id" UUID NOT NULL,
  "experienceId" UUID NOT NULL,
  "type" "TechnicalEvidenceType" NOT NULL,
  "number" VARCHAR(100) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "issuingBody" VARCHAR(255) NOT NULL,
  "issuedAt" DATE NOT NULL,
  "validUntil" DATE,
  "status" "TechnicalEvidenceStatus" NOT NULL DEFAULT 'CURRENT',
  "subjectActivity" TEXT NOT NULL,
  "professionalName" VARCHAR(255),
  "professionalIdentifier" VARCHAR(100),
  "startedAt" DATE,
  "endedAt" DATE,
  "restrictions" TEXT,
  "documentVersionId" UUID NOT NULL,
  "previousVersionId" UUID,
  "relatedCatId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" UUID NOT NULL,
  "correlationId" UUID NOT NULL,
  CONSTRAINT "technical_evidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "technical_evidence_version_positive" CHECK ("version" > 0),
  CONSTRAINT "technical_evidence_validity_order" CHECK ("validUntil" IS NULL OR "validUntil" >= "issuedAt"),
  CONSTRAINT "technical_evidence_period_complete" CHECK (("startedAt" IS NULL) = ("endedAt" IS NULL)),
  CONSTRAINT "technical_evidence_period_order" CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt"),
  CONSTRAINT "technical_evidence_professional_fields" CHECK ("type" = 'ATTESTATION' OR ("professionalName" IS NOT NULL AND "startedAt" IS NOT NULL)),
  CONSTRAINT "technical_evidence_cat_relation" CHECK ("relatedCatId" IS NULL OR "type" = 'ART')
);

CREATE UNIQUE INDEX "technical_evidence_type_number_version_key" ON "technical_evidence"("type", "number", "version");
CREATE UNIQUE INDEX "technical_evidence_previousVersionId_key" ON "technical_evidence"("previousVersionId");
CREATE INDEX "technical_evidence_experienceId_type_status_idx" ON "technical_evidence"("experienceId", "type", "status");
CREATE INDEX "technical_evidence_documentVersionId_idx" ON "technical_evidence"("documentVersionId");
CREATE INDEX "technical_evidence_relatedCatId_idx" ON "technical_evidence"("relatedCatId");
CREATE INDEX "technical_evidence_createdById_createdAt_idx" ON "technical_evidence"("createdById", "createdAt");

ALTER TABLE "technical_evidence" ADD CONSTRAINT "technical_evidence_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "executed_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "technical_evidence" ADD CONSTRAINT "technical_evidence_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "managed_document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "technical_evidence" ADD CONSTRAINT "technical_evidence_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "technical_evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "technical_evidence" ADD CONSTRAINT "technical_evidence_relatedCatId_fkey" FOREIGN KEY ("relatedCatId") REFERENCES "technical_evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "technical_evidence" ADD CONSTRAINT "technical_evidence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION enforce_technical_evidence_integrity() RETURNS trigger AS $$
DECLARE previous_record "technical_evidence"%ROWTYPE;
DECLARE cat_record "technical_evidence"%ROWTYPE;
BEGIN
  IF NEW."previousVersionId" IS NOT NULL THEN
    SELECT * INTO previous_record FROM "technical_evidence" WHERE "id" = NEW."previousVersionId";
    IF previous_record."id" IS NULL OR previous_record."type" <> NEW."type" OR previous_record."number" <> NEW."number" OR previous_record."experienceId" <> NEW."experienceId" OR NEW."version" <> previous_record."version" + 1 THEN
      RAISE EXCEPTION 'invalid technical evidence version chain';
    END IF;
  ELSIF NEW."version" <> 1 THEN
    RAISE EXCEPTION 'initial technical evidence version must be 1';
  END IF;
  IF NEW."relatedCatId" IS NOT NULL THEN
    SELECT * INTO cat_record FROM "technical_evidence" WHERE "id" = NEW."relatedCatId";
    IF cat_record."id" IS NULL OR cat_record."type" <> 'CAT' OR cat_record."experienceId" <> NEW."experienceId" THEN
      RAISE EXCEPTION 'ART must reference a CAT from the same experience';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "technical_evidence_integrity" BEFORE INSERT ON "technical_evidence" FOR EACH ROW EXECUTE FUNCTION enforce_technical_evidence_integrity();
CREATE FUNCTION prevent_technical_evidence_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'technical_evidence is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "technical_evidence_append_only" BEFORE UPDATE OR DELETE ON "technical_evidence" FOR EACH ROW EXECUTE FUNCTION prevent_technical_evidence_mutation();
