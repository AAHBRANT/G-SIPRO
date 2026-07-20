DELETE FROM "profile_permissions" WHERE "permissionId" IN (SELECT "id" FROM "permissions" WHERE "code" IN ('proposals.technical-content.edit','proposals.technical-review'));
DELETE FROM "permissions" WHERE "code" IN ('proposals.technical-content.edit','proposals.technical-review');
