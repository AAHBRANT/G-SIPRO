UPDATE "proposals"
SET "originType" = 'PUBLIC_TENDER'
WHERE "tenderVersionId" IS NOT NULL;
