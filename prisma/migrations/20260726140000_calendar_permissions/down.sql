DELETE FROM "profile_permissions" WHERE "permissionId" IN (
  SELECT "id" FROM "permissions" WHERE "code" IN ('calendar.read', 'calendar.manage')
);
DELETE FROM "permissions" WHERE "code" IN ('calendar.read', 'calendar.manage');
