# Rastreabilidade — Incremento I6 — Suporte Inteligente com IA e Provisionamento Teams

Data de abertura: registro retroativo em 25/07/2026 — a construção já estava concluída e em produção de homologação quando este documento foi redigido; não existia até então nenhum registro formal de fechamento para este incremento.

Baseline: `GSIPRO-MAN-001_Manual_de_Suporte_para_Equipe_de_Propostas_REV00` (manual de uso); não há especificação técnica (`GSIPRO-ESP`/`GSIPRO-TEC`) formalmente registrada para este incremento — recomenda-se produzi-la retroativamente.

| Item | Resultado previsto | Situação |
|---|---|---|
| BL-601 | Abertura e diagnóstico de chamados por IA | Concluído |
| BL-602 | Política de aprovação e triagem (correção autônoma vs. aprovação do proprietário) | Concluído |
| BL-603 | Pipeline autônomo de correção, publicação e implantação em homologação | Concluído |
| BL-604 | Validação humana do resultado pelo solicitante | Concluído |
| BL-605 | Provisionamento de identidade e aplicativo Microsoft Teams | Concluído |
| BL-606 | Governança de acesso privilegiado (Dono/Master) | Concluído |

## Portão de entrada

- Incremento aberto e desenvolvido diretamente em `main` via múltiplos pull requests (#4 a #13), em paralelo ao incremento I7 (Modo Analítico).
- Execução autônoma de decisão de negócio, alçada, desconto, margem, prazo ou envio: não se aplica a este incremento (escopo é suporte técnico interno, não operação comercial).

## BL-601 e BL-602 — diagnóstico e triagem

- Todo chamado (`BUG`, `QUESTION`, `IMPROVEMENT`, `NEW_FEATURE`) recebe diagnóstico automático via OpenAI Responses API, com esquema de saída estruturado (`changeClass`, `requiredActor`, `ownerActionCategory`); há um diagnóstico determinístico de reserva caso a chamada à IA falhe, garantindo que a abertura do chamado nunca fica bloqueada.
- A política de triagem decide o destino do chamado:
  - Diagnóstico indica ação externa/administrativa (Microsoft 365, Teams, Azure, identidade, segurança) → `OWNER_ACTION_REQUIRED`, sem execução de código, chamado aponta a ação exata para uma pessoa.
  - `IMPROVEMENT`/`NEW_FEATURE`, ou diagnóstico de configuração/mudança funcional/nova ferramenta → `WAITING_APPROVAL`, exige decisão do proprietário antes de qualquer execução.
  - `BUG`/`QUESTION` diagnosticado como correção simples → `TRIAGED`, elegível para execução autônoma sem aprovação humana prévia.

## BL-603 — pipeline autônomo

- Automação (`support-codex.yml`) roda a cada 5 minutos: reivindica um chamado elegível, executa o agente de IA em ambiente isolado (sandbox `workspace-write`, proibido de commitar/publicar/mexer em segredos ou nos próprios arquivos de automação), gera um diff.
- Se houver correção, o próprio pipeline (não a IA) abre um PR, roda a verificação completa (lint, tipos, testes, build) e, se aprovado, **funde e publica automaticamente** no ambiente de homologação Azure, sem clique humano intermediário.
- Falha após 3 tentativas escala o chamado para uma pessoa.
- Autenticação do pipeline junto à API é por OIDC do GitHub, com verificação estrita de repositório, branch, arquivo de workflow e ambiente de execução — impede token falsificado ou vindo de um fork.
- **Decisão do proprietário registrada em 25/07/2026:** manter a autopublicação automática como está, com os freios acima, sem exigir aprovação humana adicional para chamados classificados como correção simples.

## BL-604 — validação humana do resultado

- Quem abriu o chamado confirma se o problema foi resolvido (`CONFIRM_RESOLVED`), reporta que não foi (`REPORT_UNRESOLVED`) ou pede esclarecimento (`SUBMIT_CLARIFICATION`) — o fechamento do ciclo depende sempre de uma pessoa, mesmo quando a correção em si foi autônoma.

## BL-605 — provisionamento Teams

- O sistema nunca cria, altera ou remove uma identidade no Microsoft Entra ID — apenas localiza (leitura) uma conta já existente pelo e-mail.
- Uma vez localizada, instala automaticamente o aplicativo Teams publicado para essa pessoa via Microsoft Graph (escrita real, mas de alcance restrito a essa única ação).
- Toda tentativa, com sucesso ou falha, grava evento de auditoria imutável; erros do Graph são traduzidos para mensagens seguras, sem vazar detalhe técnico ao usuário final.

## BL-606 — governança de acesso privilegiado

- Somente quem já é Dono pode conceder o nível Dono ou Master a outra pessoa; ninguém pode promover a si mesmo; qualquer alteração em uma conta já Dono é bloqueada para quem não for Dono.

## Encerramento técnico do I6

- Testes automatizados: 11 arquivos cobrindo o domínio de suporte/agente/triagem, 3 arquivos cobrindo provisionamento Teams e governança de acesso — nenhum teste desativado ou pendente.
- Nenhuma credencial ou segredo real encontrado no código-fonte; a automação usa identidade federada (OIDC) para a Azure, sem token de longa duração armazenado.
- **Pendências para fechamento formal:** não existe especificação técnica (`GSIPRO-ESP`/`GSIPRO-TEC`) registrada para este incremento, apenas o manual de uso; não há relatório de homologação funcional assinado pelo responsável do projeto, como existe para os incrementos I0 a I5. A decisão sobre a autopublicação (acima) foi registrada, mas o incremento como um todo ainda não tem uma homologação formal equivalente à dos incrementos anteriores.
