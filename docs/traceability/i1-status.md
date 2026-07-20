# Rastreabilidade — Incremento I1

Data da verificação: 19/07/2026  
Baseline: GSIPRO-FUN-101, GSIPRO-TEC-202, GSIPRO-EXE-301, GSIPRO-PLN-302 e GSIPRO-TST-401 REV00 APROVADOS

| Item | Resultado implementado | Situação |
|---|---|---|
| BL-101 | Modelo físico de oportunidades, clientes, órgãos contratantes e histórico | Concluído no banco local |
| BL-101 | Regras de rascunho, qualificação, ativação, suspensão, encerramento e reabertura justificada | Concluído no domínio |
| BL-101 | Serviço transacional com versionamento otimista, histórico crítico e auditoria | Concluído na camada de aplicação/infraestrutura |
| BL-101 | API protegida de consulta, cadastro, atualização e transição | Concluído |
| BL-101 | Interface de consulta, cadastro, edição, transições e histórico | Concluído |
| BL-101 | Provisionamento nominal e smoke autenticado | Concluído |
| BL-102 | Detecção explicável, alerta e decisão humana justificada | Concluído |
| BL-103 | Cadastro de edital, lotes, versões e anexos por hash | Concluído |
| BL-104 | Requisitos com tipo, criticidade, responsável, trecho e página | Concluído |
| BL-105 | Prazos com data, hora, fuso, evento, fonte, responsável, alertas e confirmação humana | Concluído |
| BL-106 | Distribuição, validação e reatribuição de análises por competência | Concluído |
| BL-107 | Retificações com impactos explícitos e reabertura seletiva | Concluído |
| BL-108 | Documentos, versões imutáveis, hashes e vínculos | Concluído |

## Evidências do marco 1

- Migração `20260719014500_i1_opportunities` aplicada no PostgreSQL 18 exclusivo do G-SIPRO, porta 5433.
- Banco sincronizado com 3 migrações.
- Histórico de oportunidade protegido por trigger append-only.
- Código único e índices por situação, prazo, responsável, cliente e órgão contratante.
- Ativação bloqueada sem objeto e responsável.
- Encerramento bloqueado sem motivo padronizado.
- Reabertura bloqueada sem justificativa.
- Atualizações protegidas por versão para evitar sobrescrita concorrente.
- `pnpm check`: aprovado; 27 testes em 8 arquivos.
- `pnpm build`: aprovado com Next.js 16.2.10.
- Quatro permissões atômicas cadastradas; zero perfis atribuídos automaticamente.
- Rotas entregues: `/api/opportunities`, `/api/opportunities/[id]`, `/api/opportunities/[id]/transition` e `/opportunities`.
- Perfil `GESTOR_OPORTUNIDADES` definido por migration, com quatro permissões e uma atribuição nominal auditada.
- Smoke autenticado aprovado com o registro sintético `OP-TESTE-I1-001`: oportunidade, histórico e evento de auditoria gravados uma única vez.
- Defeito de reset do formulário encontrado no smoke, corrigido e revalidado antes do fechamento.
- Banco sincronizado com 5 migrations.
- Critério 101-AC-05 concluído com filtros por situação, responsável, prazo, cliente e faixa de valor.
- Edição autenticada elevou o registro sintético à versão 2 e atribuiu responsável; transição auditada elevou à versão 3 em qualificação.
- Alerta BL-102 identificou 100% de similaridade com `OP-TESTE-I1-001` e não criou `OP-TESTE-I1-DUP` sem decisão humana.
- Validação final: 30 testes aprovados em 9 arquivos, lint, TypeScript e build de produção aprovados.
- BL-103 iniciado com versões e anexos append-only, hash SHA-256 obrigatório e origem controlada; banco sincronizado com 6 migrations.
- Validação após início de BL-103: 33 testes aprovados em 10 arquivos e build oficial aprovado.
- Serviço transacional, API protegida e interface de editais/versionamento concluídos com perfil separado `ANALISTA_EDITAIS`.
- Smoke BL-103: `ED-TESTE-I1-001`, 1 lote, 2 versões por hashes distintos e 2 eventos de auditoria.
- Proteção append-only testada no PostgreSQL: tentativa de alterar versão documental foi rejeitada.
- Fechamento BL-103: 35 testes aprovados em 11 arquivos; banco sincronizado com 7 migrations.
- BL-104 concluído com API protegida, formulário vinculado à versão documental e histórico versionado append-only.
- Smoke BL-104: 1 requisito crítico, versão atual 2, 2 históricos e 2 eventos de auditoria; página de origem corrigida de 12 para 13 sem perda da versão anterior.
- Tentativa de alterar o histórico de requisito foi rejeitada pelo PostgreSQL.
- Fechamento BL-104: 39 testes aprovados em 13 arquivos; banco sincronizado com 9 migrations.
- BL-105 concluído com prazo crítico vinculado ao edital e ao requisito, responsável nominal, data/hora UTC, fuso de referência, evento e fonte.
- Smoke BL-105: prazo confirmado humanamente, versão 2, 1 alerta anterior ao vencimento, 2 históricos e 2 eventos de auditoria.
- Histórico de prazo protegido por trigger append-only; tentativa controlada de alteração rejeitada pelo PostgreSQL.
- Perfil `ANALISTA_EDITAIS` ampliado para 9 permissões atômicas, incluindo consulta, criação e confirmação de prazos.
- Fechamento BL-105: 45 testes aprovados em 15 arquivos; lint, TypeScript e build de produção aprovados; banco sincronizado com 11 migrations.
- BL-106 concluído para as competências técnica, jurídica, comercial, financeira e contábil, com responsável nominal e prioridade.
- Smoke BL-106: análise técnica crítica distribuída e validada humanamente, versão 2, 2 históricos e 2 eventos de auditoria.
- Reatribuição de análise pendente implementada com motivo obrigatório; decisões encerram novas reatribuições.
- Histórico de análise protegido por trigger append-only; tentativa controlada de alteração rejeitada pelo PostgreSQL.
- Perfil `ANALISTA_EDITAIS` ampliado para 13 permissões atômicas.
- Fechamento BL-106: 51 testes aprovados em 17 arquivos; lint, TypeScript e build de produção aprovados; banco sincronizado com 13 migrations.
- BL-107 concluído com retificação imutável vinculando versão anterior, versão retificadora, fonte e impactos explícitos.
- Smoke BL-107: requisito técnico impactado reaberto para `PENDING` na versão 3; requisito financeiro não impactado preservado como `VALIDATED` na versão 2.
- Retificação e impactos protegidos por trigger append-only; tentativa controlada de alteração rejeitada pelo PostgreSQL.
- Perfil `ANALISTA_EDITAIS` ampliado para 15 permissões atômicas.
- Fechamento BL-107: 55 testes aprovados em 19 arquivos; lint, TypeScript e build de produção aprovados; banco sincronizado com 15 migrations.
- BL-108 concluído com documento lógico separado do arquivo, classificação, proprietário, versões por URI e SHA-256 e vínculos genéricos por entidade e papel.
- Smoke BL-108: 1 documento confidencial técnico, 2 versões com hashes distintos, 1 vínculo ao edital e 4 eventos de auditoria.
- Versões e vínculos protegidos por trigger append-only; tentativa de alteração e tentativa de repetir hash foram rejeitadas pelo PostgreSQL.
- Perfil `ANALISTA_EDITAIS` ampliado para 19 permissões atômicas.
- Fechamento BL-108 e I1: 60 testes aprovados em 21 arquivos; lint, TypeScript e build de produção aprovados; banco sincronizado com 17 migrations.

## Próximo corte

Incremento I1 concluído. Próxima ação: executar homologação funcional assistida e abrir o incremento I2 conforme o backlog aprovado.
