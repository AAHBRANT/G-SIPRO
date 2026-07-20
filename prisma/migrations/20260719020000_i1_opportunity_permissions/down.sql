DELETE FROM "permissions"
WHERE "code" IN ('opportunities.read', 'opportunities.create', 'opportunities.update', 'opportunities.transition');
