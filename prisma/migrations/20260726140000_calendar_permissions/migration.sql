-- Agenda (calendário): recurso "da equipe", por decisão do proprietário
-- concedido a todos os perfis ativos, não a um único perfil como nas
-- features anteriores.
INSERT INTO "permissions" ("id", "code", "module", "action", "description", "createdAt", "createdBy") VALUES
('a6100000-0000-4000-8000-000000000001', 'calendar.read', 'calendar', 'read', 'Consultar a agenda consolidada (prazos de editais, entregas de proposta e compromissos de equipe)', CURRENT_TIMESTAMP, '00000000-0000-0000-0000-000000000000'),
('a6100000-0000-4000-8000-000000000002', 'calendar.manage', 'calendar', 'manage', 'Criar, editar e cancelar compromissos de equipe na agenda', CURRENT_TIMESTAMP, '00000000-0000-0000-0000-000000000000')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "profile_permissions" ("profileId", "permissionId", "grantedAt", "grantedBy")
SELECT p."id", perm."id", CURRENT_TIMESTAMP, '00000000-0000-0000-0000-000000000000'
FROM "profiles" p
CROSS JOIN "permissions" perm
WHERE p."active" = true AND perm."code" IN ('calendar.read', 'calendar.manage')
ON CONFLICT ("profileId", "permissionId") DO NOTHING;
