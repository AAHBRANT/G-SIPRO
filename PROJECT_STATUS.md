# G-SIPRO — Status do projeto

> Este arquivo existe para que qualquer sessão nova do Claude Code (em qualquer máquina) consiga
> retomar o trabalho lendo só este arquivo + `git log`. Atualize-o ao final de cada sessão de trabalho
> relevante. Não é documentação de arquitetura (isso fica em `docs/`) — é um "onde paramos".

Última atualização: 2026-08-12. Branch `feat/buscador-gsipro` (Buscador G-SIPRO) em revisão, sem merge.

## Ambientes

- Repositório: https://github.com/AAHBRANT/G-SIPRO (branch `main`). **Foi transferido** de `gutembergp-droid/G-SIPRO` para a organização `AAHBRANT` em 2026-07-31 — a URL antiga ainda redireciona, mas use a nova. Se clonar de novo, use a URL nova diretamente.
- ⚠️ **Cuidado com force-push:** a transferência envolveu um force-push que descartou um commit já publicado (recuperado via `git cherry-pick` neste mesmo dia). Antes de confiar cegamente em `git pull --rebase`, rode `git log --oneline -10` depois e confira se nada do que você esperava sumiu — principalmente logo após qualquer operação administrativa no repositório (transferência, proteção de branch, etc.).
- Homologação (Azure):
  - Container App: `ca-gsipro-hml-aahbrant`
  - Resource Group: `rg-gsipro-hml-brazilsouth`
  - ACR: `acrgsiprohml27207f`
  - Postgres: `psql-gsipro-hml-27207f` (Key Vault `kv-gsipro-hml-27207f`, secret `database-url`)
- Local dev: Postgres em `localhost:5433/gsipro`, servidor em `localhost:3001` (`pnpm dev`, ver `.claude/launch.json`)
- Pipeline de deploy padrão: `az acr build --registry acrgsiprohml27207f --resource-group rg-gsipro-hml-brazilsouth --image gsipro:<tag> -f Dockerfile .` → confirmar com `az acr repository show-tags` (não confiar só em `list-runs`) → `az containerapp update --name ca-gsipro-hml-aahbrant --resource-group rg-gsipro-hml-brazilsouth --image acrgsiprohml27207f.azurecr.io/gsipro:<tag> --revision-suffix <único>` → checar `/api/health` e `/api/readiness`.
- As migrations do Prisma rodam sozinhas na subida do container (`scripts/apply-database-migrations.mjs` no `CMD` do Dockerfile) — não é preciso aplicar manualmente em produção/homologação.

## Trabalho em revisão — Buscador G-SIPRO (APP-MOD-201)

> Está na branch `feat/buscador-gsipro`, **sem merge**.

### Segunda rodada (2026-08-12) — pedidos da equipe de propostas

1. **Captação restrita a obras a partir de R$ 14 milhões.** Abaixo disso não
   compensa a mobilização. Valor sigiloso continua entrando: orçamento fechado
   é comum em obra grande.
2. **Dois defeitos corrigidos** que apareceram no uso em homologação: o contador
   exibia as linhas carregadas (200) em vez do total pendente (801), e o objeto
   vinha prefixado com o nome da plataforma de disputa.
3. **Fila filtrável**: região, tipo de obra e esfera em menus de marcação
   múltipla com contagem; busca por objeto/órgão/cidade; ordenação por prazo,
   valor ou captação; quatro indicadores no topo; linha que abre com
   identificação, prazos e caminho para o edital.
4. O **tipo de obra** passou a ser gravado na varredura (migration
   `20260812090000`, testada contra banco real com 57 registros: coluna criada
   NOT NULL com `ARRAY[]`, nenhum nulo).

Verificação: **481 testes**, lint e typecheck limpos, `next build` compilando.

### Decidido e ainda NÃO implementado

- **Ordenação por aderência** — valor e distância são um critério só: o piso de
  R$ 14 mi sobe conforme a obra se afasta das filiais. Depende de **as filiais
  estarem cadastradas em Bases Operacionais com endereço** — confirmar se há dado.
- **Pré-análise do edital** (acervo exigido, consórcio, garantia, visita), lendo
  o PDF do PNCP (`/api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/arquivos`,
  verificado) e mandando **só os trechos relevantes** à Central IA — não o edital
  inteiro. ⚠️ A Central IA roda modelo local em CPU e leva de 197 s a 302 s por
  chamada: precisa ser **assíncrona e em lote**, nunca dentro de uma requisição.
- **Regra de captação acordada:** só entra o que podemos disputar — acervo
  próprio ou consórcio permitido. O que não atendemos e não permite consórcio
  não deve ser captado.
- **Dicionário de equivalências de serviço**: a IA propõe, a equipe confirma uma
  vez, vira regra determinística. Níveis visíveis: idêntico · equivalente
  (confirmado) · provável (IA sugeriu) · não atende. Obra de maior porte cobrindo
  exigência menor **sinaliza, nunca afirma** — nem toda comissão aceita.
- O mínimo de quantitativo para parcela de maior relevância costuma ser 50%, mas
  **varia por edital**: tem que sair da leitura, nunca ficar fixo no código.

## O que foi feito

**2026-07-27 — Módulo de Calendário** (chamado de suporte **SUP-00009**, que pedia calendário + participantes + Teams + o que se revelou ser um bug de fuso):

1. Fuso horário corrigido — horário sem fuso explícito (vindo do formulário) agora é interpretado como Brasília (-03:00), não UTC.
2. Suporte a múltiplos participantes por compromisso (além do responsável), com tabela `calendar_event_participants`.
3. Sincronização com Outlook/Teams via Microsoft Graph (criar/editar/cancelar compromisso, participantes como convidados) — melhor esforço, nunca bloqueia a operação local.
4. Notificação por e-mail ao responsável quando o compromisso é criado/reatribuído por outra pessoa (o Graph não avisa automaticamente o dono do evento, só convidados).

**2026-07-31 — Sugestão de órgão contratante** (chamado **SUP-00019** — "não preenchimento dos dados na Oportunidade"):

O órgão/cliente já costumava aparecer entre os campos que a IA extrai dos documentos anexados (ex.: "Órgão Contratante"), mas nada usava essa informação para preencher o campo estruturado da Oportunidade, e isso bloqueava "Validar e avançar" por Cliente/Órgão ausente. Agora a tela sugere o órgão identificado nos documentos com um botão de vincular em um clique.

Tudo publicado em homologação; `pnpm check` passando (386 testes).

## Pendências / decisões em aberto

1. **PR #16 no GitHub** (https://github.com/AAHBRANT/G-SIPRO/pull/16) — tentativa automática da IA de suporte para o chamado SUP-00009, falhou na validação, ficou aberta e agora está em conflito com o que já foi publicado em `main`. Perguntei ao proprietário se posso fechá-la; **aguardando resposta**.
2. **Chamado SUP-00009** — resolvido tecnicamente, mas ainda não fechado pelo solicitante na tela de Suporte (fluxo próprio do app exige validação/confirmação por lá).
3. **"Capacidade financeira do cliente" no Módulo Analítico** (tarefa aberta desde a reforma do Módulo Analítico) — bloqueada. Falta decisão do proprietário sobre como a nova lista manual de pontos (mesmo padrão da funcionalidade "Atratividade") deve conviver com o sistema formal de avaliação financeira que já existe. Não perguntar de novo proativamente — só retomar se o proprietário trouxer o assunto.
4. **Chamados abertos aguardando o proprietário** (consultados em 2026-07-31): #11, #13 e #15 esperando aprovação; #8 esperando validação; vários chamados #16 a #22 são dúvidas/testes recentes ainda não triados manualmente.

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
