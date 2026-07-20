DELETE FROM "profile_permissions" WHERE "permissionId" IN (SELECT "id" FROM "permissions" WHERE "code" IN ('compliance-matrices.finalize','compliance-matrices.export'));
DELETE FROM "permissions" WHERE "code" IN ('compliance-matrices.finalize','compliance-matrices.export');

