WITH identified AS (
  UPDATE "support_tickets"
  SET
    "status" = 'OWNER_ACTION_REQUIRED',
    "externalBlocker" = jsonb_build_object(
      'category', 'TEAMS',
      'summary', 'A disponibilidade do aplicativo para novos usuários depende da atribuição administrativa do G-SIPRO no Microsoft Teams; não há evidência de defeito no código da aplicação.',
      'ownerAction', E'1. Acesse o Centro de administração do Teams com a função Administrador do Teams.\n2. Abra Aplicativos do Teams > Gerenciar aplicativos > G-SIPRO.\n3. Em Usuários e grupos, edite a disponibilidade e inclua somente os usuários ou o grupo autorizado que precisa utilizar o G-SIPRO.\n4. Em Gerenciar usuários, abra cada usuário afetado e confirme na guia Aplicativos que o G-SIPRO aparece como disponível.\n5. Aguarde a propagação da Microsoft e teste no Teams Web e no aplicativo, após sair e entrar novamente.',
      'securityGuidance', 'Use a função Administrador do Teams e a atribuição ao grupo ou aos usuários necessários. Não conceda Administrador Global, não disponibilize o aplicativo para toda a organização e não desative MFA ou políticas de acesso.',
      'reportedBy', 'migração-controlada-sup-00008',
      'reportedAt', CURRENT_TIMESTAMP
    ),
    "ownerActionRequiredAt" = CURRENT_TIMESTAMP,
    "executionLeaseId" = NULL,
    "executorId" = NULL,
    "executionClaimedAt" = NULL,
    "executionHeartbeatAt" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "number" = 8
    AND "status" IN ('TRIAGED', 'IN_PROGRESS')
  RETURNING "id"
)
INSERT INTO "support_ticket_updates" (
  "id", "ticketId", "fromStatus", "toStatus", "note", "createdById", "actorLabel"
)
SELECT
  gen_random_uuid(),
  "id",
  NULL,
  'OWNER_ACTION_REQUIRED',
  'A IA identificou uma configuração protegida do Microsoft Teams. O proprietário recebeu a causa, o procedimento de menor privilégio e os cuidados de segurança. O chamado permanece aberto.',
  NULL,
  'Política de segurança do suporte'
FROM identified;
