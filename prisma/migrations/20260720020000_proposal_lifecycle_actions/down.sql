DELETE FROM "profile_permissions" WHERE "permissionId" IN (SELECT "id" FROM "permissions" WHERE "code" IN ('proposals.manage-status','proposals.delete'));
DELETE FROM "permissions" WHERE "code" IN ('proposals.manage-status','proposals.delete');
DROP INDEX "proposals_deletedAt_idx";
ALTER TABLE "proposals" DROP COLUMN "deletedBy", DROP COLUMN "deletedAt", DROP COLUMN "statusChangedAt", DROP COLUMN "statusReason";
