DELETE FROM "profile_permissions" WHERE "permissionId" IN (SELECT "id" FROM "permissions" WHERE "code" IN ('technical-professionals.read','technical-professionals.create'));
DELETE FROM "permissions" WHERE "code" IN ('technical-professionals.read','technical-professionals.create');
