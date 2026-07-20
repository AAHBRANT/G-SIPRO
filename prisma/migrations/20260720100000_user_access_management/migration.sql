ALTER TABLE "users"
ADD COLUMN "isMaster" BOOLEAN NOT NULL DEFAULT false;

UPDATE "users"
SET "isMaster" = true,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE LOWER("email") = 'gutemberg.pontes@aahbrant.com';
