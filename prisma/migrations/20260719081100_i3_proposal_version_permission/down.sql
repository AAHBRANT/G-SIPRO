DELETE FROM "profile_permissions" WHERE "permissionId" IN (SELECT "id" FROM "permissions" WHERE "code"='proposals.create-version');
DELETE FROM "permissions" WHERE "code"='proposals.create-version';
