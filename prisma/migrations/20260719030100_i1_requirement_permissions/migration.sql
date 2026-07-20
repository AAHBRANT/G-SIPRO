INSERT INTO "permissions" ("id", "code", "module", "action", "description", "createdAt", "createdBy") VALUES
('a3000000-0000-4000-8000-000000000001', 'requirements.read', 'requirements', 'read', 'Consultar requisitos e evidências de origem', CURRENT_TIMESTAMP, '00000000-0000-0000-0000-000000000000'),
('a3000000-0000-4000-8000-000000000002', 'requirements.create', 'requirements', 'create', 'Registrar requisito em versão documental', CURRENT_TIMESTAMP, '00000000-0000-0000-0000-000000000000'),
('a3000000-0000-4000-8000-000000000003', 'requirements.update', 'requirements', 'update', 'Alterar requisito com histórico versionado', CURRENT_TIMESTAMP, '00000000-0000-0000-0000-000000000000')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "profile_permissions" ("profileId", "permissionId", "grantedAt", "grantedBy")
SELECT 'a2100000-0000-4000-8000-000000000001', "id", CURRENT_TIMESTAMP, '00000000-0000-0000-0000-000000000000'
FROM "permissions" WHERE "code" IN ('requirements.read', 'requirements.create', 'requirements.update')
ON CONFLICT ("profileId", "permissionId") DO NOTHING;
