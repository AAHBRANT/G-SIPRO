DELETE FROM "profile_permissions" WHERE "permissionId" IN (SELECT "id" FROM "permissions" WHERE "code"='technical-archive.search');
DELETE FROM "permissions" WHERE "code"='technical-archive.search';
