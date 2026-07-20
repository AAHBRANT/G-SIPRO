ALTER TABLE "proposals" ADD COLUMN "title" VARCHAR(255);
UPDATE "proposals" p SET "title" = COALESCE(NULLIF(o."subject", ''), p."code") FROM "opportunities" o WHERE o."id" = p."opportunityId";
UPDATE "proposals" SET "title" = "code" WHERE "title" IS NULL;
ALTER TABLE "proposals" ALTER COLUMN "title" SET NOT NULL;
