DELETE FROM "profile_permissions" WHERE "permissionId" IN (SELECT "id" FROM "permissions" WHERE "code" IN ('proposals.read','proposals.create'));
DELETE FROM "permissions" WHERE "code" IN ('proposals.read','proposals.create');
