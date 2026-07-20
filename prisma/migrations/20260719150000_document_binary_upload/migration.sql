ALTER TABLE "tender_versions"
  ADD COLUMN "uri" VARCHAR(1000),
  ADD COLUMN "mimeType" VARCHAR(160),
  ADD COLUMN "sizeBytes" BIGINT;

ALTER TABLE "tender_versions"
  ADD CONSTRAINT "tender_versions_size_positive" CHECK ("sizeBytes" IS NULL OR "sizeBytes" > 0);

COMMENT ON COLUMN "tender_versions"."uri" IS 'Localizador imutável do arquivo original; nulo somente para registros legados anteriores ao upload obrigatório.';
