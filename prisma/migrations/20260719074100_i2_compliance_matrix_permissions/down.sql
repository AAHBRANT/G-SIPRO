DELETE FROM "profile_permissions" WHERE "permissionId" IN (SELECT "id" FROM "permissions" WHERE "code" IN ('requirements.validate','compliance-matrices.read','compliance-matrices.create'));
DELETE FROM "permissions" WHERE "code" IN ('requirements.validate','compliance-matrices.read','compliance-matrices.create');

