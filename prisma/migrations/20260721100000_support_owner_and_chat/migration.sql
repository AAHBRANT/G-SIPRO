ALTER TABLE "users" ADD COLUMN "isOwner" BOOLEAN NOT NULL DEFAULT false;

WITH selected_owner AS (
  SELECT "id"
  FROM "users"
  WHERE "isMaster" = true AND "status" = 'ACTIVE'
  ORDER BY CASE WHEN lower("email") = 'gutemberg.pontes@aahbrant.com' THEN 0 ELSE 1 END, "createdAt"
  LIMIT 1
)
UPDATE "users"
SET "isOwner" = true
WHERE "id" = (SELECT "id" FROM selected_owner);

ALTER TABLE "users"
ADD CONSTRAINT "users_owner_requires_master"
CHECK (NOT "isOwner" OR ("isMaster" AND "status" = 'ACTIVE'));

CREATE INDEX "users_isOwner_status_idx" ON "users"("isOwner", "status");
