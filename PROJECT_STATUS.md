# G-SIPRO — Status do projeto

> Este arquivo existe para que qualquer sessão nova do Claude Code (em qualquer máquina) consiga
> retomar o trabalho lendo só este arquivo + `git log`. Atualize-o ao final de cada sessão de trabalho
> relevante. Não é documentação de arquitetura (isso fica em `docs/`) — é um "onde paramos".

Última atualização: 2026-08-01, commit `8250233` + branch local `feat/buscador-gsipro` não publicada.

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

## O que foi feito na última sessão (2026-08-01) — Buscador G-SIPRO (APP-MOD-201)

Módulo novo de **captação automática de licitações**, aprovado pelo proprietário em sessão de
concepção (documento `APP-MOD-201 — Buscador G-SIPRO`, REV01, com mockups validados).

Varredura semanal aos domingos na consulta pública do PNCP → funil de enquadramento pelo perfil
da empresa → fila de triagem → **aprovar cadastra a oportunidade automaticamente** (origem
`BUSCADOR`, status `QUALIFICATION`, responsável = quem aprovou). O sistema afunila e organiza;
a decisão é sempre humana — não há recomendação automática.

O que foi construído:

1. Módulo `src/modules/scouting` (domínio, aplicação, infraestrutura) — 48 testes próprios.
2. Banco: origem `BUSCADOR` + tabelas `scout_filters`, `scout_runs`, `scouted_tenders`
   (duas migrations; a do enum foi isolada por causa da restrição de transação do
   `ALTER TYPE ... ADD VALUE`).
3. API: `POST /api/scouting/scan` (token dedicado, chamado pelo agendador),
   `GET|PUT /api/scouting/filters`, `POST /api/scouting/scouted-tenders/[id]/decision`.
4. Telas: `/scouting` (filtros) e `/opportunities/scouted` (fila de triagem); card
   "Oportunidades Rastreadas" em primeiro lugar na tela de Oportunidades e item "Buscador"
   na barra lateral, com contador de pendências.
5. Agendamento: `.github/workflows/buscador-scan.yml`, `cron: 0 9 * * 0` (domingo, 06:00 BRT).
   O país é varrido em **seis lotes de unidades federativas**, um por requisição — a varredura
   nacional inteira levaria de 15 a 29 minutos e seria encerrada pelo balanceador. O cliente
   ainda tem teto próprio de duração (200 s) e para sozinho antes de estourar.

Verificado contra banco e portal reais em 01/08/2026 (PostgreSQL descartável na máquina de
trabalho, PNCP de verdade): migrations aplicadas, 189 licitações buscadas no Ceará, 57 enquadradas,
aprovação criando `PPB-010-26` com origem BUSCADOR / status Em análise / responsável = quem aprovou,
descarte com motivo e autor, e não repetição confirmada (57 de 57 reconhecidas).

Dois defeitos foram encontrados nesse teste e corrigidos: a consulta nacional sem recorte por
unidade federativa faz o portal responder HTTP 500, e horizonte de 18 meses estoura o tempo limite.

Verificação local: **433 testes**, lint e typecheck limpos, `next build` compilando todas as
rotas novas. **Nada foi publicado** — sem commit em `main`, sem push, sem deploy. O trabalho está
na branch local `feat/buscador-gsipro`.

**Ainda não validado:** as **telas** nunca foram abertas. O acesso exige Microsoft Entra ID e a
máquina de trabalho não tem credencial corporativa, então a navegação pela interface — barra
lateral, card, fila de triagem e formulário de filtros — permanece sem verificação visual. Tudo o
que roda por baixo delas foi exercitado contra banco e portal reais.

Ver a seção "Como publicar o Buscador" no final deste arquivo.

## O que foi feito na sessão anterior (2026-07-27)

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

## Como publicar o Buscador (APP-MOD-201)

Roteiro preparado em 2026-07-29 e revisado em 2026-08-01, após a verificação contra banco e portal
reais. Nada aqui foi executado no ambiente de vocês. Siga na ordem.

### 0. Antes de tudo — verificar a versão do PostgreSQL

```
az postgres flexible-server show --name psql-gsipro-hml-27207f --resource-group rg-gsipro-hml-brazilsouth --query version
```

A migration `20260728195900_buscador_origin_enum` usa `ALTER TYPE ... ADD VALUE`. Em
PostgreSQL **12 ou superior** funciona dentro de transação (é o caso do Azure Flexible Server).
Se por algum motivo o servidor for **11 ou anterior**, essa migration precisa ser aplicada
manualmente fora de transação, antes do deploy.

### 1. Validar as telas (o que ainda falta)

As camadas de dados e integração já foram verificadas. O que resta é a interface, que exige
login corporativo. Numa máquina com o PostgreSQL local do G-SIPRO na 5433 e credencial do Entra:


```
pnpm install
pnpm prisma migrate dev
pnpm check
pnpm dev
```

Roteiro de teste pela tela:

1. `/scouting` abre, mostra os filtros e salva alterações.
2. `POST /api/scouting/scan` com o token responde e grava uma varredura em `scout_runs`
   (verificar `totalFetched`, `totalQualified`, `totalNew`).
3. A barra lateral passa a exibir o contador ao lado de Oportunidades.
4. O card "Oportunidades Rastreadas" aparece em primeiro lugar, em destaque.
5. Na fila, **Aprovar** cria a oportunidade — conferir na relação: origem "Buscador G-SIPRO",
   status "Em análise", responsável = quem aprovou, órgão preenchido quando o nome coincide
   com um órgão já cadastrado.
6. **Descartar** exige motivo e remove da fila sem apagar o registro.
7. Rodar a varredura uma segunda vez e confirmar que **nada já triado volta para a fila**.

### 2. Criar o segredo do agendador

Gerar um token de 32+ caracteres (não reaproveitar o de notificações):

```
openssl rand -base64 48
```

Cadastrar em dois lugares:

- **GitHub** → Settings → Secrets and variables → Actions → `SCOUT_DISPATCH_TOKEN`
- **Azure** → variável de ambiente `SCOUT_DISPATCH_TOKEN` no Container App
  (`ca-gsipro-hml-aahbrant`), preferencialmente via Key Vault, como os demais segredos.

Sem esse valor a rota responde `CONFIGURATION_INVALID` e o workflow de domingo falha.

### 3. Publicar

Pipeline padrão do projeto:

```
az acr build --registry acrgsiprohml27207f --resource-group rg-gsipro-hml-brazilsouth --image gsipro:<tag> -f Dockerfile .
az acr repository show-tags --name acrgsiprohml27207f --repository gsipro
az containerapp update --name ca-gsipro-hml-aahbrant --resource-group rg-gsipro-hml-brazilsouth --image acrgsiprohml27207f.azurecr.io/gsipro:<tag> --revision-suffix <único>
```

As migrations rodam sozinhas na subida do container
(`scripts/apply-database-migrations.mjs` no `CMD` do Dockerfile).

Conferir depois: `/api/health`, `/api/readiness` e a tela `/scouting`.

### 4. Primeira varredura

Não esperar o domingo: disparar o workflow **G-SIPRO Buscador — varredura semanal** pelo
`workflow_dispatch` e acompanhar o resultado em `/scouting` (bloco "Últimas varreduras").

A primeira execução varre o país inteiro e pode demorar alguns minutos — o portal limita a
frequência de requisições e o cliente reenvia com espera crescente.

### 5. Ajustes que dependem da equipe

- Revisar os filtros em `/scouting` com a equipe de licitações antes da primeira triagem
  (a configuração padrão não descarta nada automaticamente — apenas sinaliza).
- Confirmar se as permissões reaproveitadas (`opportunities.read` para ver,
  `opportunities.update` para salvar filtros, `opportunities.create` para aprovar) atendem
  à alçada desejada, ou se o Buscador precisa de permissões próprias.

### Pendências conhecidas

- **Condições do certame** (sessão presencial, fiança, visita técnica etc.) são configuráveis
  na tela, mas ainda **não são avaliadas**: dependem da leitura do edital e do termo de
  referência, que é o Estágio 2 do funil — ainda não implementado.
- **Dossiê da licitação** (quadro-resumo, CAT completa, check-list de documentos) está
  desenhado e aprovado, mas não construído; a previsão é entrar como aba da oportunidade.
- **Cruzamento com o acervo técnico** depende do contrato de integração com a ferramenta de
  atestados, ainda não definido.
- **Vínculo de órgão** ocorre só quando o nome confere exatamente com um órgão já cadastrado;
  o módulo nunca cria órgão novo, para não poluir o cadastro mestre.
