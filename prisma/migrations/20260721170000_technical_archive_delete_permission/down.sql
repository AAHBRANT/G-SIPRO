DELETE FROM "profile_permissions" WHERE "permissionId" IN (SELECT "id" FROM "permissions" WHERE "code"='technical-archive.delete');
DELETE FROM "permissions" WHERE "code"='technical-archive.delete';
