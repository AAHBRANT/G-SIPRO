# Rastreabilidade — Incremento I0

Data da verificação: 19/07/2026  
Baseline: GSIPRO-EXE-301, GSIPRO-PLN-302 e GSIPRO-TST-401 REV00 APROVADOS

| Item | Resultado implementado | Situação |
|---|---|---|
| BL-001 | Scaffold Next.js/TypeScript, catálogo de 12 módulos e ADRs | Fundação concluída |
| BL-002 | ESLint sem warnings, TypeScript estrito, Vitest, cobertura e CI | Fundação concluída |
| BL-003 | Validação Zod, `.env.example` e segredos fora do código | Fundação concluída |
| BL-004 | Microsoft Entra ID single-tenant, Auth.js, sessão JWT de 8 horas e acesso negado por padrão | Fundação concluída |
| BL-005 | Política de autorização com negação por padrão, permissão e escopo | Fundação concluída |
| BL-006 | Esquema Prisma/PostgreSQL, migration inicial e `down.sql` | Fundação concluída; aplicação em banco depende de instância autorizada |
| BL-007 | Evento de auditoria imutável, contrato append-only e trigger contra alteração/exclusão | Fundação concluída |
| BL-008 | Correlação, logging com redação, erros de API e endpoint de saúde | Fundação concluída |

## Evidências

- `pnpm check`: aprovado.
- Testes: 15 aprovados em 6 arquivos.
- Cobertura: 100% de linhas, funções e instruções; 94,73% de branches.
- `pnpm build`: aprovado com Next.js 16.2.10.
- Smoke test `GET /api/health`: status `ok` e correlação preservada.
- Readiness `GET /api/readiness`: verifica conexão real com PostgreSQL sem expor credenciais ou detalhes de falha.
- Prisma: schema formatado, validado e cliente gerado com Prisma 7.8.0.
- PostgreSQL 18.4: serviço ativo, usuário sem privilégios administrativos, 8 tabelas e 2 migrations aplicadas.
- Credencial local: ignorada pelo Git e ACL restrita ao usuário, SYSTEM e administradores.
- Microsoft Entra ID: aplicativo corporativo single-tenant registrado, retorno Web local configurado e segredo com validade controlada armazenado somente no `.env.local` protegido.
- Execução local: porta `3001`, pois a porta `3000` já está ocupada por outra aplicação autorizada; ambos os retornos locais permanecem registrados no Entra.
- Smoke de identidade: saúde pública `200`, página protegida redirecionada `307`, API privada negada `401` e provedor Entra disponível `200`.

## Limites atuais

- PostgreSQL 18 de desenvolvimento provisionado na porta 5433, isolado da instância PostgreSQL 16 existente.
- A credencial Entra de desenvolvimento expira em 15/01/2027 e deve ser rotacionada antes dessa data.
- O URI de produção deverá ser cadastrado no Entra antes da implantação; o registro atual contém somente retornos locais aprovados.
- O serviço Windows Time permanece sem fonte automática nesta estação; a TI deverá configurar sincronização permanente antes de homologação/produção. O relógio local foi corrigido para o teste.
- O Incremento I1 foi iniciado em 19/07/2026 pelo corte BL-101; seu acompanhamento está em `docs/traceability/i1-status.md`.
