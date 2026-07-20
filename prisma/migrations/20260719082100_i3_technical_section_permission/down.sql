DELETE FROM "profile_permissions" WHERE "permissionId"=(SELECT "id" FROM "permissions" WHERE "code"='proposals.technical-sections.manage');
DELETE FROM "permissions" WHERE "code"='proposals.technical-sections.manage';
