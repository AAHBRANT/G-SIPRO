DELETE FROM "profile_permissions" WHERE "permissionId" IN (SELECT "id" FROM "permissions" WHERE "code"='compliance-matrices.validate-item');
DELETE FROM "permissions" WHERE "code"='compliance-matrices.validate-item';

