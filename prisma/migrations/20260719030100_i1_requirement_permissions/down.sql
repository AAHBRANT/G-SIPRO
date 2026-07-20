DELETE FROM "profile_permissions" WHERE "permissionId" IN (SELECT "id" FROM "permissions" WHERE "code" IN ('requirements.read', 'requirements.create', 'requirements.update'));
DELETE FROM "permissions" WHERE "code" IN ('requirements.read', 'requirements.create', 'requirements.update');
