-- I1 / BL-103 - Cadastro de editais, lotes, versões e anexos.
CREATE TYPE "TenderVersionStatus" AS ENUM ('RECEIVED', 'IN_ANALYSIS', 'VALIDATED', 'SUBSTITUTED');

CREATE TABLE "tenders" (
  "id" UUID NOT NULL, "code" VARCHAR(50) NOT NULL, "number" VARCHAR(100) NOT NULL,
  "modality" VARCHAR(100) NOT NULL, "subject" TEXT NOT NULL, "origin" VARCHAR(500) NOT NULL,
  "opportunityId" UUID, "contractingAuthorityId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdBy" UUID NOT NULL,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL, "updatedBy" UUID NOT NULL,
  CONSTRAINT "tenders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tender_lots" (
  "id" UUID NOT NULL, "tenderId" UUID NOT NULL, "code" VARCHAR(80) NOT NULL, "subject" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdBy" UUID NOT NULL,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL, "updatedBy" UUID NOT NULL,
  CONSTRAINT "tender_lots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tender_versions" (
  "id" UUID NOT NULL, "tenderId" UUID NOT NULL, "version" INTEGER NOT NULL,
  "fileName" VARCHAR(255) NOT NULL, "fileHash" CHAR(64) NOT NULL, "source" VARCHAR(500) NOT NULL,
  "receivedAt" TIMESTAMPTZ(6) NOT NULL, "status" "TenderVersionStatus" NOT NULL DEFAULT 'RECEIVED',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdBy" UUID NOT NULL,
  CONSTRAINT "tender_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tender_attachments" (
  "id" UUID NOT NULL, "tenderVersionId" UUID NOT NULL, "fileName" VARCHAR(255) NOT NULL,
  "fileHash" CHAR(64) NOT NULL, "source" VARCHAR(500) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdBy" UUID NOT NULL,
  CONSTRAINT "tender_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenders_code_key" ON "tenders"("code");
CREATE INDEX "tenders_number_modality_idx" ON "tenders"("number", "modality");
CREATE INDEX "tenders_opportunityId_idx" ON "tenders"("opportunityId");
CREATE INDEX "tenders_contractingAuthorityId_idx" ON "tenders"("contractingAuthorityId");
CREATE UNIQUE INDEX "tender_lots_tenderId_code_key" ON "tender_lots"("tenderId", "code");
CREATE INDEX "tender_versions_status_receivedAt_idx" ON "tender_versions"("status", "receivedAt");
CREATE UNIQUE INDEX "tender_versions_tenderId_version_key" ON "tender_versions"("tenderId", "version");
CREATE UNIQUE INDEX "tender_versions_tenderId_fileHash_key" ON "tender_versions"("tenderId", "fileHash");
CREATE UNIQUE INDEX "tender_attachments_tenderVersionId_fileHash_key" ON "tender_attachments"("tenderVersionId", "fileHash");

ALTER TABLE "tenders" ADD CONSTRAINT "tenders_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_contractingAuthorityId_fkey" FOREIGN KEY ("contractingAuthorityId") REFERENCES "contracting_authorities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tender_lots" ADD CONSTRAINT "tender_lots_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "tenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tender_versions" ADD CONSTRAINT "tender_versions_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "tenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tender_attachments" ADD CONSTRAINT "tender_attachments_tenderVersionId_fkey" FOREIGN KEY ("tenderVersionId") REFERENCES "tender_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_tender_document_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'tender document versions and attachments are append-only'; END;
$$;
CREATE TRIGGER tender_versions_append_only BEFORE UPDATE OR DELETE ON "tender_versions" FOR EACH ROW EXECUTE FUNCTION prevent_tender_document_mutation();
CREATE TRIGGER tender_attachments_append_only BEFORE UPDATE OR DELETE ON "tender_attachments" FOR EACH ROW EXECUTE FUNCTION prevent_tender_document_mutation();
COMMENT ON TABLE "tender_versions" IS 'GSIPRO-FUN-103: versoes documentais imutaveis identificadas por SHA-256.';
