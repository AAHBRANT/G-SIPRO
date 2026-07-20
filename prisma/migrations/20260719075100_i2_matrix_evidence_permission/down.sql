DELETE FROM "profile_permissions" WHERE "permissionId" IN (SELECT "id" FROM "permissions" WHERE "code"='compliance-matrices.associate-evidence');
DELETE FROM "permissions" WHERE "code"='compliance-matrices.associate-evidence';
