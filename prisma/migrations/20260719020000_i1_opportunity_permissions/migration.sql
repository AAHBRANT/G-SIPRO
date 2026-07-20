-- Permissões atômicas do BL-101. Nenhum perfil ou usuário recebe concessão automática.
INSERT INTO "permissions" ("id", "code", "module", "action", "description", "createdAt", "createdBy")
VALUES
  ('a1000000-0000-4000-8000-000000000001', 'opportunities.read', 'opportunities', 'read', 'Consultar e filtrar oportunidades', CURRENT_TIMESTAMP, '00000000-0000-0000-0000-000000000000'),
  ('a1000000-0000-4000-8000-000000000002', 'opportunities.create', 'opportunities', 'create', 'Cadastrar oportunidades em rascunho', CURRENT_TIMESTAMP, '00000000-0000-0000-0000-000000000000'),
  ('a1000000-0000-4000-8000-000000000003', 'opportunities.update', 'opportunities', 'update', 'Alterar dados de oportunidades', CURRENT_TIMESTAMP, '00000000-0000-0000-0000-000000000000'),
  ('a1000000-0000-4000-8000-000000000004', 'opportunities.transition', 'opportunities', 'transition', 'Alterar o ciclo de vida de oportunidades', CURRENT_TIMESTAMP, '00000000-0000-0000-0000-000000000000')
ON CONFLICT ("code") DO NOTHING;
