-- Permissões e perfil funcional do BL-103. Atribuições nominais ficam fora da migration.
INSERT INTO "permissions" ("id", "code", "module", "action", "description", "createdAt", "createdBy") VALUES
('a2000000-0000-4000-8000-000000000001', 'tenders.read', 'tenders', 'read', 'Consultar editais, lotes, versões e anexos', CURRENT_TIMESTAMP, '00000000-0000-0000-0000-000000000000'),
('a2000000-0000-4000-8000-000000000002', 'tenders.create', 'tenders', 'create', 'Cadastrar edital com versão documental inicial', CURRENT_TIMESTAMP, '00000000-0000-0000-0000-000000000000'),
('a2000000-0000-4000-8000-000000000003', 'tenders.version', 'tenders', 'version', 'Acrescentar nova versão documental e anexos', CURRENT_TIMESTAMP, '00000000-0000-0000-0000-000000000000')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "profiles" ("id", "code", "name", "description", "active", "createdAt", "createdBy", "updatedAt", "updatedBy") VALUES
('a2100000-0000-4000-8000-000000000001', 'ANALISTA_EDITAIS', 'Analista de Editais', 'Consulta, cadastra e versiona editais e anexos sem sobrescrever documentos anteriores.', true, CURRENT_TIMESTAMP, '00000000-0000-0000-0000-000000000000', CURRENT_TIMESTAMP, '00000000-0000-0000-0000-000000000000')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "profile_permissions" ("profileId", "permissionId", "grantedAt", "grantedBy")
SELECT 'a2100000-0000-4000-8000-000000000001', "id", CURRENT_TIMESTAMP, '00000000-0000-0000-0000-000000000000'
FROM "permissions" WHERE "code" IN ('tenders.read', 'tenders.create', 'tenders.version')
ON CONFLICT ("profileId", "permissionId") DO NOTHING;
