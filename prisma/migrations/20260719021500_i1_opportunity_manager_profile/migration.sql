-- Perfil funcional do BL-101. A atribuição nominal permanece fora da migration.
INSERT INTO "profiles" ("id", "code", "name", "description", "active", "createdAt", "createdBy", "updatedAt", "updatedBy")
VALUES (
  'a1100000-0000-4000-8000-000000000001',
  'GESTOR_OPORTUNIDADES',
  'Gestor de Oportunidades',
  'Consulta, cadastra, atualiza e movimenta oportunidades no ciclo de vida aprovado.',
  true,
  CURRENT_TIMESTAMP,
  '00000000-0000-0000-0000-000000000000',
  CURRENT_TIMESTAMP,
  '00000000-0000-0000-0000-000000000000'
)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "profile_permissions" ("profileId", "permissionId", "grantedAt", "grantedBy")
SELECT
  'a1100000-0000-4000-8000-000000000001',
  "id",
  CURRENT_TIMESTAMP,
  '00000000-0000-0000-0000-000000000000'
FROM "permissions"
WHERE "code" IN ('opportunities.read', 'opportunities.create', 'opportunities.update', 'opportunities.transition')
ON CONFLICT ("profileId", "permissionId") DO NOTHING;
