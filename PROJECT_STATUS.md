# G-SIPRO — Status do projeto

> Este arquivo existe para que qualquer sessão nova do Claude Code (em qualquer máquina) consiga
> retomar o trabalho lendo só este arquivo + `git log`. Atualize-o ao final de cada sessão de trabalho
> relevante. Não é documentação de arquitetura (isso fica em `docs/`) — é um "onde paramos".

Última atualização: 2026-07-27, commit `a5e8a3b`.

## Ambientes

- Repositório: https://github.com/gutembergp-droid/G-SIPRO (branch `main`)
- Homologação (Azure):
  - Container App: `ca-gsipro-hml-aahbrant`
  - Resource Group: `rg-gsipro-hml-brazilsouth`
  - ACR: `acrgsiprohml27207f`
  - Postgres: `psql-gsipro-hml-27207f` (Key Vault `kv-gsipro-hml-27207f`, secret `database-url`)
- Local dev: Postgres em `localhost:5433/gsipro`, servidor em `localhost:3001` (`pnpm dev`, ver `.claude/launch.json`)
- Pipeline de deploy padrão: `az acr build --registry acrgsiprohml27207f --resource-group rg-gsipro-hml-brazilsouth --image gsipro:<tag> -f Dockerfile .` → confirmar com `az acr repository show-tags` (não confiar só em `list-runs`) → `az containerapp update --name ca-gsipro-hml-aahbrant --resource-group rg-gsipro-hml-brazilsouth --image acrgsiprohml27207f.azurecr.io/gsipro:<tag> --revision-suffix <único>` → checar `/api/health` e `/api/readiness`.
- As migrations do Prisma rodam sozinhas na subida do container (`scripts/apply-database-migrations.mjs` no `CMD` do Dockerfile) — não é preciso aplicar manualmente em produção/homologação.

## O que foi feito na última sessão (2026-07-27)

Módulo de Calendário (chamado de suporte **SUP-00009**, que pedia calendário + participantes + Teams + o que se revelou ser um bug de fuso):

1. Fuso horário corrigido — horário sem fuso explícito (vindo do formulário) agora é interpretado como Brasília (-03:00), não UTC.
2. Suporte a múltiplos participantes por compromisso (além do responsável), com tabela `calendar_event_participants`.
3. Sincronização com Outlook/Teams via Microsoft Graph (criar/editar/cancelar compromisso, participantes como convidados) — melhor esforço, nunca bloqueia a operação local.
4. Notificação por e-mail ao responsável quando o compromisso é criado/reatribuído por outra pessoa (o Graph não avisa automaticamente o dono do evento, só convidados).

Tudo publicado em homologação, revisão `ca-gsipro-hml-aahbrant--sup9notifya5e8a3b` (100% do tráfego), `pnpm check` passando (382 testes).

## Pendências / decisões em aberto

1. **PR #16 no GitHub** (https://github.com/gutembergp-droid/G-SIPRO/pull/16) — tentativa automática da IA de suporte para o mesmo chamado SUP-00009, falhou na validação, ficou aberta e agora está em conflito com o que já foi publicado em `main`. Perguntei ao proprietário se posso fechá-la; **aguardando resposta**.
2. **Chamado SUP-00009** — resolvido tecnicamente, mas ainda não fechado pelo solicitante na tela de Suporte (fluxo próprio do app exige validação/confirmação por lá).
3. **"Capacidade financeira do cliente" no Módulo Analítico** (tarefa aberta desde a reforma do Módulo Analítico) — bloqueada. Falta decisão do proprietário sobre como a nova lista manual de pontos (mesmo padrão da funcionalidade "Atratividade") deve conviver com o sistema formal de avaliação financeira que já existe. Não perguntar de novo proativamente — só retomar se o proprietário trouxer o assunto.

## Como uma sessão nova deve retomar

1. Ler este arquivo inteiro.
2. Rodar `git log --oneline -15` para confirmar se algo mudou desde a "última atualização" acima (o bot autônomo de suporte também commita direto em `main`, então pode haver commits novos).
3. Se houver uma pendência listada acima ainda sem decisão, perguntar ao usuário antes de agir — não presumir.
4. Ao terminar um bloco relevante de trabalho, atualizar este arquivo (data, commit, o que mudou, novas pendências).
