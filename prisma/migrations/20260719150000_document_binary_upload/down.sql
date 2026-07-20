ALTER TABLE "tender_versions" DROP CONSTRAINT IF EXISTS "tender_versions_size_positive";
ALTER TABLE "tender_versions" DROP COLUMN IF EXISTS "sizeBytes", DROP COLUMN IF EXISTS "mimeType", DROP COLUMN IF EXISTS "uri";
