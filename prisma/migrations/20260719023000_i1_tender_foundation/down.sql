DROP TRIGGER IF EXISTS tender_attachments_append_only ON "tender_attachments";
DROP TRIGGER IF EXISTS tender_versions_append_only ON "tender_versions";
DROP FUNCTION IF EXISTS prevent_tender_document_mutation();
DROP TABLE IF EXISTS "tender_attachments";
DROP TABLE IF EXISTS "tender_versions";
DROP TABLE IF EXISTS "tender_lots";
DROP TABLE IF EXISTS "tenders";
DROP TYPE IF EXISTS "TenderVersionStatus";
