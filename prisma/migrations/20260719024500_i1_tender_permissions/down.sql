DELETE FROM "profile_permissions" WHERE "profileId" = 'a2100000-0000-4000-8000-000000000001';
DELETE FROM "profiles" WHERE "id" = 'a2100000-0000-4000-8000-000000000001';
DELETE FROM "permissions" WHERE "code" IN ('tenders.read', 'tenders.create', 'tenders.version');
