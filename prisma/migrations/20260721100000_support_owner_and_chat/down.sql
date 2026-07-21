DROP INDEX IF EXISTS "users_isOwner_status_idx";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_owner_requires_master";
ALTER TABLE "users" DROP COLUMN IF EXISTS "isOwner";
