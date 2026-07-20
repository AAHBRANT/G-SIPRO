UPDATE "proposals"
SET "originType" = 'DIRECT'
WHERE "tenderVersionId" IS NOT NULL;
