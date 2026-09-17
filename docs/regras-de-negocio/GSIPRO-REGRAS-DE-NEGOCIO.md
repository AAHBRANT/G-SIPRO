# G-SIPRO — Regras de Negócio (Visão Geral do Sistema)

**Fonte:** repositório [AAHBRANT/G-SIPRO](https://github.com/AAHBRANT/G-SIPRO) (branch `main`), extraído do código-fonte (`domain/*.ts`, `application/*-service.ts`, `infrastructure/prisma-*-repository.ts`, rotas `presentation/*-api.ts`) e cruzado com `docs/specifications/`, `docs/adr/` e `docs/plans/` do próprio repositório.
**Data da extração:** 2026-09-17
**Método:** leitura automatizada do código por módulo (não é transcrição de reunião de negócio nem de spec funcional — é o que o sistema *implementa* hoje). Onde o código não deixa claro uma regra, isso está sinalizado explicitamente como *"não fica claro no código"*.

> ⚠️ Este documento descreve o comportamento **implementado**, não necessariamente o comportamento **desejado**. Ele é um retrato do código nesta data — puxe de novo se o sistema evoluir.

---

## Índice

1. [Visão geral da arquitetura](#1-visão-geral-da-arquitetura)
2. [Prospecção e Oportunidades](#2-prospecção-e-oportunidades)
   - 2.1 Prospecção / Buscador de editais (`scouting`)
   - 2.2 Oportunidades (`opportunities`)
   - 2.3 Inteligência de Oportunidade (`opportunity-intelligence`)
3. [Editais e Habilitação](#3-editais-e-habilitação)
   - 3.1 Editais (`tenders`)
   - 3.2 Requisitos de Habilitação (`requirements`)
   - 3.3 Prazos (`deadlines`)
   - 3.4 Retificações (`rectifications`)
   - 3.5 Matriz de Conformidade (`compliance-matrices`)
   - 3.6 Análises de Requisito (`analyses`)
4. [Propostas e Concorrências](#4-propostas-e-concorrências)
   - 4.1 Propostas (`proposals`)
   - 4.2 Seções Técnicas (`proposal-sections`)
   - 4.3 Revisão Técnica (`proposal-reviews`)
   - 4.4 Vínculo Proposta-Edital (`proposal-tender-link`)
   - 4.5 Propostas Comerciais (`commercial-proposals`)
   - 4.6 Concorrências (`competitions`)
5. [Acervo, Indicadores, Suporte e Governança de IA](#5-acervo-indicadores-suporte-e-governança-de-ia)
   - 5.1 Acervo Técnico (`technical-archive`)
   - 5.2 Documentos Gerenciados (`documents`)
   - 5.3 Indicadores (`indicators`)
   - 5.4 Calendário (`calendar`)
   - 5.5 Central de Suporte (`support`)
   - 5.6 Governança de IA (`ai-governance`)
   - 5.7 Extração de Dados via IA (`ai-extraction`)
   - 5.8 Administração (`admin`)
6. [Referências e leitura complementar](#6-referências-e-leitura-complementar)

---

## 1. Visão geral da arquitetura

O G-SIPRO é um **monólito modular** (Next.js + Prisma + PostgreSQL), documentado em `docs/adr/0001-monolito-modular.md`. Cada módulo de negócio em `src/modules/<nome>/` segue a mesma separação em 4 camadas:

- **`domain/`** — entidades, schemas de validação (Zod) e invariantes puras de negócio.
- **`application/`** — serviços que orquestram casos de uso (bastante finos na maioria dos módulos).
- **`infrastructure/`** — repositórios Prisma; **é onde a maior parte das regras de negócio "pesadas" realmente está implementada** (bloqueios de transição, checagens de concorrência otimista, cálculos, auditoria).
- **`presentation/`** — rotas de API (`route.ts`).

Padrões transversais observados em praticamente todos os módulos:

- **Trilha de auditoria imutável**: toda criação/transição relevante gera um `AuditEvent`.
- **Versionamento com histórico**: entidades centrais (editais, requisitos, prazos, propostas, indicadores, casos de uso de IA) são versionadas, muitas vezes em "cadeia" (uma revisão só pode partir da versão mais recente).
- **Concorrência otimista**: atualizações condicionadas ao número de versão (`version`), com erro dedicado em caso de conflito.
- **Hashes SHA-256** para integridade documental e reprodutibilidade de cálculos (editais, evidências, exportações de matriz, indicadores, extrações de IA).
- **Governança de IA** como pré-requisito obrigatório: nenhuma chamada a modelo de IA ocorre sem caso de uso aprovado, modelo ativo e permissão do usuário.

---

## 2. Prospecção e Oportunidades

### 2.1 Prospecção / Buscador de editais (`scouting`)

**Propósito:** varrer o PNCP em busca de licitações de obra pública, filtrar as que combinam com o perfil da empresa e apoiar a triagem humana até a conversão em oportunidade — sem nunca decidir participar sozinho.

**Regras de negócio:**
- A varredura roda com um filtro de perfil (`ScoutFilter`); sem filtro configurado, usa um padrão com piso de R$ 14 milhões, palavras-chave e tipos de obra sugeridos.
- Qualificação (Estágio 1) usa só dados cadastrais públicos do PNCP (esfera, estado, palavras-chave, tipo de obra, valor estimado/sigiloso, prazo mínimo). Exigências de habilitação do edital em si são Estágio 2 (fora deste módulo).
- Valor sigiloso (comum sob a Lei 14.133 antes da fase de lances) nunca é tratado como zero — é qualificado/rejeitado por flag própria (`includeUndisclosedValue`).
- Licitação já triada (aprovada ou descartada) nunca retorna à fila; a que vence o prazo sem triagem expira automaticamente.
- **Sinalização**: marca colorida por licitação (HIGH/MEDIUM/LOW fixos, ou CUSTOM com rótulo/cor livres); só aplicável a registro `PENDING`; sinalizar de novo substitui a marca anterior.
- **Triagem/decisão humana**: só se aplica a `PENDING`.
  - Aprovar cria uma oportunidade com origem `BUSCADOR`, status `QUALIFICATION`, aprovador como responsável.
  - Descartar exige motivo (mín. 3 caracteres); descarte automático (duplicata resolvida) pode não ter ator.
- **Duplicidade entre licitações**: agrupamento por órgão + (número de processo OU objeto normalizado); CNPJs diferentes sob nome igual nunca são agrupados (evita colidir dois municípios homônimos); nunca oculta a duplicata, só sinaliza — decisão de ignorar é de quem lê.
- **Aderência ao perfil**: nota 0–100 (tipo de obra 40%, valor/porte 30%, prazo 20%, esfera 10%); critério sem dado sai do numerador e do denominador (nunca vira zero nem nota cheia).
- **Aderência de acervo técnico**: mede se há prova de execução prévia; parcela do edital não reconhecida pelo catálogo nunca conta como coberta nem como faltante; quantitativo mínimo usa o maior atestado isolado, nunca a soma.
- **Aderência combinada**: perfil e acervo pesam 50/50; sem acervo julgado, nunca fecha 100.
- **Pré-requisitos**: lista ordenada por criticidade (acervo → porte → prazo → valor → itens que só o edital revela: consórcio, CAT/CREA-CAU, visita técnica, garantia de proposta); status `MET`/`NOT_MET`/`ATTENTION`/`UNKNOWN`.
- **Leitura de edital por IA**: o PDF nunca é armazenado, só o resultado interpretado + hash SHA-256 do que foi lido; releitura com `force` sobrescreve, sem `force` reaproveita (`ALREADY_READ`); documentos são priorizados por régua de relevância (termo de referência > projeto básico > edital > memorial > anexo > demais); há modo por IA (exige caso de uso aprovado) e modo por casamento de padrão sem IA (reforço ou único método quando `onlyPatternMatch`); falha em um documento nunca derruba o lote inteiro.
- Comparação de quantitativo nunca converte entre dimensões diferentes sem dado de largura; percentual mínimo exigido vem sempre do edital, nunca de constante fixa no código.

**Estados/transições:**
- Licitação rastreada: `PENDING → APPROVED` (cria oportunidade) | `PENDING → DISCARDED` | `PENDING → EXPIRED`. Sem transição a partir de estado final.

**Validações-chave:** `ScoutFilter` exige ao menos uma esfera; `minimumValue ≤ maximumValue`; motivo de descarte 3–1000 caracteres; sinalização `CUSTOM` com contraste mínimo de cor recalculado (4,6:1).

---

### 2.2 Oportunidades (`opportunities`)

**Propósito:** administrar o ciclo de vida cadastral e de status de uma oportunidade comercial, da captação até o encerramento.

**Regras de negócio:**
- Origem fixa: `CHANNEL | REFERRAL | PORTAL | CUSTOMER | PROSPECTING | BUSCADOR`.
- **Código**: automático no padrão `PPB-NNN-AA` (reinicia por ano; 2026 começa em 10 para continuar registros manuais `PPB_001`..`009`) ou sequencial por prefixo customizado; imutável após gerado.
- Valor estimado exige moeda e fonte (`valueSource`) juntos; datas (publicação/entrega) exigem fonte e fuso horário juntos, se informadas.
- **Duplicidade**: candidatos pontuados por similaridade de objeto (Jaccard ≥ 70%) + mesmo cliente/órgão (score combinado 75%/25%, corte 0.7, top 5); seguir apesar de duplicata exige decisão `CREATE_SEPARATE` com justificativa de 10–1000 caracteres.
- Rascunho quase vazio é sinalizado (não bloqueado) quando ≤1 campo importante preenchido.
- **Ativação (`ACTIVE`)** exige: objeto, responsável, cliente **ou** órgão, valor estimado (com moeda/fonte), data de entrega, fonte/fuso de datas — falta qualquer um e a transição é rejeitada com a lista de campos faltantes.
- **Encerramento (`CLOSED`)** exige motivo padronizado; **reabertura** (`CLOSED → QUALIFICATION`) exige justificativa.
- Toda transição para `ACTIVE` vinda de outro estado sinaliza conversão para proposta.
- Toda atualização registra mudanças em campos críticos (antes/depois) para auditoria.

**Estados/transições (`OpportunityStatus`):**

| De | Para permitido |
|---|---|
| `DRAFT` | `QUALIFICATION` |
| `QUALIFICATION` | `ACTIVE`, `SUSPENDED`, `CLOSED` |
| `ACTIVE` | `SUSPENDED`, `CLOSED` |
| `SUSPENDED` | `ACTIVE`, `CLOSED` |
| `CLOSED` | `QUALIFICATION` (reabertura, com justificativa) |

Qualquer transição fora dessa tabela é rejeitada.

**Validações-chave:** código restrito a maiúsculas/dígitos/hífen/underscore (máx. 50); valor estimado não-negativo; moeda com 3 caracteres. *Não fica claro no código*: regra de unicidade do código a nível de banco; quem pode forçar transições além do `ownerId`.

---

### 2.3 Inteligência de Oportunidade (`opportunity-intelligence`)

**Propósito:** produzir análise multi-perspectiva auditável (comercial, técnica, estudos climáticos/logísticos) resultando em pontuação, recomendação e notificação — sem presumir dados inexistentes.

**Regras de negócio:**
- Três perspectivas fixas: `COMMERCIAL`, `TECHNICAL`, `STUDIES`, com dimensões configuráveis por **política aprovada** (pesos somam exatamente 100; `recommendedMinimum > restrictionsMinimum`; `coverageMinimum` aprovado em 70%; exatamente 2 regras de impedimento: `HIGH_INDEBTEDNESS_RISK` e `NON_PAYING_CUSTOMER`; aprovação exige nota de 10–1000 caracteres).
- **Análise comercial**: score 0–100 por completude de campos; precisa de ≥2 de 4 sinais materiais para ser calculável, senão fica `NOT_CALCULABLE` (recomendação nunca ultrapassa `WAITING_INFORMATION`).
- **Capacidade técnica**: pontuação ponderada por criticidade do requisito (`LOW`=1…`CRITICAL`=4) × decisão (`MEETS`=100, `PARTIAL`=50, `DOES_NOT_MEET`=0); requisito `CRITICAL` + `DOES_NOT_MEET` → reprova a oportunidade (`hasCriticalFailure`); crítico sem avaliação ou `PARTIAL` → bloqueia recomendação (`hasUnresolvedCritical`).
- **Estudo climático**: soma chuva histórica só dos meses do período da obra; **nunca** converte precipitação em atraso/praticabilidade automaticamente (regra ainda não aprovada) — dimensão sempre `NOT_CALCULABLE`.
- **Estudo de rotas/logística**: sem seleção manual de base, fica `PENDING_RULE` (não há escolha automática de "melhor base" sem regra aprovada); ausência de rota nunca é lida como custo/distância zero.
- **Avaliação de pagamento do cliente**: exige exatamente um vínculo (cliente OU órgão); justificativa 20–5000 caracteres + ≥1 evidência; `NON_PAYER` é gatilho de impedimento crítico.
- **Avaliação financeira**: sem índices formais, conclusão forçada a `INSUFFICIENT_DATA`; qualquer índice reprovado força `HIGH_RISK` (segundo gatilho de impedimento crítico), mesmo que o usuário indicasse `ADEQUATE`.
- **Consolidação**: falha crítica → `NOT_RECOMMENDED` definitivo; crítico não resolvido / cobertura ou confiança abaixo do mínimo → `WAITING_INFORMATION`; score ≥ mínimo recomendado → `RECOMMENDED`; entre limites → `RECOMMENDED_WITH_RESTRICTIONS`; abaixo → `NOT_RECOMMENDED`.
- **Impedimento crítico** nunca encerra a oportunidade sozinho — gera solicitação obrigatória ao proprietário; só o proprietário pode contrariar recomendação `NOT_RECOMMENDED`, com justificativa de 20–2000 caracteres, decisão auditada (`PROCEED` / `PROCEED_WITH_RESTRICTIONS` / `DO_NOT_PROCEED`).
- **Gate de homologação**: 8 áreas fixas devem estar cobertas; qualquer `FAIL` → `REJECTED`; área ausente/`BLOCKED` → `BLOCKED`; tudo `PASS` sem aprovação do responsável → `WAITING_OWNER_APPROVAL`; tudo `PASS` + aprovação → `APPROVED`.
- **Notificações**: impedimento crítico sempre gera `IMPEDIMENT_DETECTED` + `OWNER_DECISION_REQUIRED`; pendência sem impedimento gera `INFORMATION_REQUESTED`; senão `ANALYSIS_COMPLETED`; mudança de recomendação sempre soma `RECOMMENDATION_CHANGED`.
- Despacho de notificações usa outbox transacional com lease; status final `SENT` / `PARTIAL` / `RETRY` (backoff exponencial até 60 min) / `FAILED` (após 5 tentativas).

**Estados envolvidos:** Recomendação (`RECOMMENDED`, `RECOMMENDED_WITH_RESTRICTIONS`, `NOT_RECOMMENDED`, `WAITING_INFORMATION`); Status da análise (`QUEUED`, `COLLECTING`, `CALCULATING`, `AI_EXPLAINING`, `WAITING_INFORMATION`, `WAITING_OWNER`, `SUCCEEDED`, `PARTIAL`, `FAILED`); Gate de homologação (`APPROVED`, `REJECTED`, `BLOCKED`, `WAITING_OWNER_APPROVAL`).

---

## 3. Editais e Habilitação

### 3.1 Editais (`tenders`)

- Edital sempre nasce com sua primeira versão documental (`version = 1`); novas versões são sempre `última + 1` (sem pular/repetir).
- Toda criação/versão gera auditoria (`TENDER_CREATED` / `TENDER_VERSION_ADDED`) com hash do arquivo.
- Campos obrigatórios: código, número, modalidade, objeto, origem; lotes opcionais (máx. 500).
- Cada versão exige hash SHA-256, URI, MIME, tamanho positivo, fonte e data de recebimento; anexos seguem o mesmo padrão (máx. 1000 por versão).
- **Não há máquina de estado** para o edital — controle de ciclo de vida é por versionamento incremental de documento, não por status.
- *Não fica claro no código*: unicidade de `code`/`number` não é reforçada explicitamente na aplicação (pode depender de constraint de banco).

### 3.2 Requisitos de Habilitação (`requirements`)

- Todo requisito nasce `DRAFT`, versão 1.
- Editar um requisito `VALIDATED` o rebaixa automaticamente para `PENDING_VALIDATION` — qualquer alteração exige nova validação.
- Toda revisão incrementa versão e grava histórico com `before`/`after`.
- **Validar** exige justificativa (mín. 10 caracteres); requisito `REJECTED` não pode ser validado sem revisão prévia; exige ao menos uma análise vinculada; **todas** as análises vinculadas devem estar `VALIDATED` para o requisito passar a `VALIDATED`.
- Concorrência otimista por versão (`RequirementConcurrencyError` em conflito).

**Estados:** `DRAFT` → `PENDING_VALIDATION` → `VALIDATED` / `REJECTED`; qualquer edição de `VALIDATED` volta para `PENDING_VALIDATION`. *Não fica claro no código* como um requisito sai de `REJECTED`.

### 3.3 Prazos (`deadlines`)

- Todo prazo nasce `PENDING_CONFIRMATION`, versão 1.
- **Confirmar** exige justificativa (mín. 10 caracteres) e só é permitido em `PENDING_CONFIRMATION`; qualquer outro status é bloqueado.
- Alertas associados devem ocorrer antes do `dueAt` (validado no schema).
- Concorrência otimista; toda ação gera histórico + auditoria.

**Estados:** `PENDING_CONFIRMATION → CONFIRMED` (implementado); `COMPLETED`/`CANCELLED` existem no tipo mas *não fica claro no código* quem os produz.

### 3.4 Retificações (`rectifications`)

- Liga sempre uma versão anterior a uma versão retificadora **posterior** do mesmo edital.
- Exige ao menos 1 impacto (máx. 100), cada um apontando um requisito do mesmo edital; sem repetição de requisito na mesma retificação.
- Para cada impacto com `requiresRevalidation: true` (default), **todas** as análises não-`PENDING` daquele requisito são reabertas automaticamente (`VALIDATED`/`REJECTED` → `PENDING`), com histórico `REOPENED_BY_RECTIFICATION`.
- *Não fica claro no código*: se a reabertura de análises também rebaixa o status do requisito em si (o código só reabre as análises).

### 3.5 Matriz de Conformidade (`compliance-matrices`)

- **Criação**: só a partir de requisitos `VALIDATED`; bloqueia se houver qualquer requisito `DRAFT`/`PENDING_VALIDATION`, ou se não houver nenhum `VALIDATED`. Nasce `IN_ANALYSIS`, versão 1, um item por requisito (snapshot do requisito no momento).
- **Evidência**: só associável com matriz `IN_ANALYSIS`; comparação quantitativa deve pertencer à mesma experiência/contrato da evidência; regra de conversão de unidade "tudo ou nada" (se unidades diferem, fator/regra/fonte são obrigatórios juntos); valor normalizado = bruto × fator (arredondado a 6 casas).
- **Avaliação do item**: só com matriz `IN_ANALYSIS`; decisão `MEETS`/`PARTIAL` exige ≥1 evidência associada; responsável de tratamento deve ser usuário `ACTIVE` com `dueAt` futuro; `PARTIAL`/`DOES_NOT_MEET` exige pacote de tratamento completo (gap, risco, impacto, tratamento, responsável, prazo — tudo ou nada); cada nova avaliação gera nova versão preservando snapshot das evidências vigentes.
- **Finalização/exportação**: idempotente se já `VALIDATED` com exportação existente; só finaliza `IN_ANALYSIS`; **todo item precisa ter ao menos uma avaliação**; **nenhum item pode ter evidência mais nova que a última avaliação** (bloqueia com "aguardando revalidação"); ao finalizar, matriz vira `VALIDATED`, gera JSON canônico com hash SHA-256 como `fileHash` do arquivo de exportação; download recalcula e confere o hash (`MatrixExportIntegrityError` em divergência).

**Estados:** `IN_ANALYSIS → VALIDATED` (única transição, irreversível no código lido).

### 3.6 Análises de Requisito (`analyses`)

- Toda análise nasce `PENDING`, versão 1, vinculada a competência (`TECHNICAL|LEGAL|COMMERCIAL|FINANCIAL|ACCOUNTING`) e responsável.
- **Decidir** só em `PENDING`; decisão `VALIDATED`/`REJECTED` sempre com justificativa (mín. 10 caracteres).
- **Reatribuir** só em `PENDING`; motivo obrigatório; reatribuir para o mesmo responsável é bloqueado.
- Concorrência otimista por versão.

**Estados:** `PENDING → VALIDATED / REJECTED`; reabertura `VALIDATED`/`REJECTED` → `PENDING` só ocorre via módulo `rectifications` (efeito colateral), não diretamente. *Não fica claro no código*: checagem de que o `assigneeId` seja usuário ativo.

---

## 4. Propostas e Concorrências

### 4.1 Propostas (`proposals`)

- Criação real só a partir de uma **oportunidade** com `status = ACTIVE` e já com `ownerId` (delegada); uma oportunidade só gera **uma** proposta não excluída.
- `originType` inferido automaticamente (`PUBLIC_TENDER` se há edital vinculado, senão `DIRECT`); se a origem não exige edital, não pode informar `tenderVersionId`/`tenderLotId` (que devem vir sempre juntos e pertencer à mesma oportunidade/edital).
- Código herdado da oportunidade (não é livre). Toda proposta nasce na versão 1 com dois componentes obrigatórios (`TECHNICAL`, `COMMERCIAL`) em `DRAFT`; documentos-fonte da oportunidade são herdados automaticamente.
- **Nova versão** exige versão anterior existente + motivo (10–1000 caracteres); recria os dois componentes em `DRAFT` e força o status de volta a `PREPARATION` — uma nova versão "reabre" o ciclo.

**Estados (`ProposalStatus`):** `PREPARATION → REVIEW → APPROVAL → SENT → JUDGED → CLOSED → FINALIZED` (+ `CANCELLED`). Nestes módulos só estão implementadas `PREPARATION→REVIEW`, `REVIEW→APPROVAL`, `APPROVAL→SENT`; *não fica claro no código* como se chega a `JUDGED`/`CLOSED`/`FINALIZED`/`CANCELLED`.

**"Congelamento" técnico:** proposta `SENT` não pode mais ter o componente comercial alterado — exige nova versão antes.

### 4.2 Seções Técnicas (`proposal-sections`)

- Só criável se a **versão atual** da proposta já tem componente `TECHNICAL`. Responsável deve ser usuário `ACTIVE`. Requisitos vinculados devem estar `VALIDATED` e pertencer à mesma versão do edital da proposta.
- **`COMPLETED` só é atingível via revisão técnica aprovada** (módulo 4.3) — nunca por atualização direta.
- Só altera seções da versão atual (versões antigas são imutáveis); concorrência otimista por versão (`TechnicalSectionConflictError`).

**Estados:** `DRAFT → IN_PROGRESS → (IN_REVIEW) → COMPLETED`. *Não fica claro no código*: uso efetivo do estado `IN_REVIEW` (definido no schema, não encontrado em uso).

### 4.3 Revisão Técnica (`proposal-reviews`)

- Todas as ações só na versão atual da proposta. Só o **responsável atual da seção** pode elaborar conteúdo/vincular evidência.
- Conteúdo versionado em cadeia com hash SHA-256; primeiro conteúdo de seção `DRAFT` move automaticamente para `IN_PROGRESS`.
- Evidência só vinculável se `TechnicalEvidence.status = CURRENT`.
- Comentários: severidade `NORMAL`/`CRITICAL`, nascem `OPEN`; resolução só sobre comentário aberto da mesma seção.
- **Aprovação da revisão exige**: zero comentários abertos + ao menos uma evidência vinculada + conteúdo versionado existente. Aprovado → seção `COMPLETED`; `CHANGES_REQUIRED` → mantém/volta `IN_PROGRESS`.

### 4.4 Vínculo Proposta-Edital (`proposal-tender-link`)

- **Idempotente**: se a proposta já tem edital/lote vinculado, retorna o vínculo existente (`reused: true`).
- Documento informado deve ser versão de documento gerenciado tipo `EDITAL`, já vinculado à proposta como `SOURCE_DOCUMENT`.
- **Reaproveitamento por hash**: `TenderVersion` com mesmo `fileHash` na mesma oportunidade é reaproveitado em vez de duplicar.
- Caso contrário, cria novo edital automaticamente (código `EDT-<código da proposta>`, modalidade inferida do `originType`, lote único `LOTE-UNICO`, preservando hash/nome/URI originais) — tudo em transação atômica.
- Ao concluir, promove `originType: DIRECT → PUBLIC_TENDER` (não altera se já era `PRIVATE_COMPETITION`).

### 4.5 Propostas Comerciais (`commercial-proposals`)

- **Criação de cenário**: bloqueada se proposta `SENT`; `estimatedValue > 0`; cálculo determinístico (`lineCost`, `linePrice`, `totalCost`, `offeredPrice > 0`, `discountPercent`, `marginAmount`, `marginPercent`), tudo com hash de cálculo (`calculationHash`) e versão de fórmula fixa (`GSIPRO-CALC-001`).
- Cenários versionados em cadeia por `scenarioKey` — revisão só a partir da versão mais recente. Criação move proposta para `REVIEW`.
- **Regra de alçada**: nova versão por `code` a cada publicação (nunca sobrescreve); exige permissão `proposals.commercial.approve`; vigência e limites (moeda/valor/desconto/margem) opcionais no schema — *não fica claro no código* se os limites são checados automaticamente no momento da aprovação (pode estar em constraint de banco).
- **Aprovação**: só sobre a versão mais recente do cenário; justificativa 10–2000 caracteres; aprovado → proposta `APPROVAL`; rejeitado → volta/mantém `REVIEW`.
- **Envio (`submit`)**: exige cenário **aprovado** da versão atual, evidência documental do envio, e **todas** as seções técnicas `COMPLETED` e versionadas. Gera payload de envio com hash (snapshot técnico + comercial) — funciona como o "congelamento" real da proposta. Move para `SENT`.

**Workflow (`ProposalWorkflowStage`):** `PREPARATION → TECHNICAL → COMMERCIAL → APPROVAL → SENT`, tudo versionado em `ProposalWorkflowEvent`.

### 4.6 Concorrências (`competitions`)

- Lote deve pertencer ao edital informado; **um lote só pode ter uma concorrência** (relação 1:1).
- **Participante**: nome legal normalizado é chave única de deduplicação (`identityReused: true` se já existir); `status` (`EXPECTED`/`PARTICIPATING`/`WITHDRAWN`) e `factStatus` (`ESTIMATED`/`CONFIRMED`) sempre com fonte/data.
- **Oferta, Ato processual, Categoria de motivo**: todos versionados em cadeia própria (`offerKey`/`actKey`/`categoryKey`) — revisão só a partir da versão mais recente.
- Ato do tipo `JUDGMENT` exige participante, classificação, habilitação e critério; `DILIGENCE`/`APPEAL`/`COUNTERARGUMENT` exigem prazo.
- **Resultado**: outcomes `WIN`/`LOSS`/`DISQUALIFICATION`/`CANCELLATION`; exige justificativa e evidência; versionado por concorrência.
- **Valor contratado/homologação**: só registrável se resultado for `WIN` **e já validado** — bloqueio explícito caso contrário.
- *Não fica claro no código*: integração automática entre resultado da concorrência e `ProposalStatus`/`ProposalWorkflowStage` (não há atualização automática visível nestes módulos).

---

## 5. Acervo, Indicadores, Suporte e Governança de IA

### 5.1 Acervo Técnico (`technical-archive`)

- Experiência (contrato executado) exige código (`[A-Z0-9-]{3,50}`), contratante, objeto, período, ≥1 serviço com ≥1 quantitativo, documento comprobatório; período da obra contido no período do contrato; valor e moeda sempre juntos. Nasce `DRAFT`, versão 1.
- Evidência técnica (`ATTESTATION | CAT | ART`): validade não pode anteceder emissão; CAT/ART exigem profissional e período de vínculo; só ART pode referenciar CAT relacionada. Versionada em cadeia (mesma experiência/tipo/número).
- Cadastro de profissional é dado pessoal (LGPD): exige finalidade de tratamento (mín. 10 caracteres) e base legal; vínculo a `TECHNICAL_EVIDENCE` só aceita CAT/ART (nunca Atestado); toda listagem de profissionais gera evento de auditoria de acesso a dado pessoal.
- Busca no acervo exige ≥1 filtro preenchido; quantitativo mín./máx. exige unidade.
- **Exclusão é lógica** (soft delete, status `DELETED`), exige permissão `technical-archive.delete`, motivo (mín. 5 caracteres), só para documentos `ATESTADO` ainda não excluídos.

### 5.2 Documentos Gerenciados (`documents`)

- Documento exige tipo, título, classificação (`PUBLIC|INTERNAL|CONFIDENTIAL_COMMERCIAL|CONFIDENTIAL_TECHNICAL|PERSONAL_DATA|AUDIT`) e proprietário; nasce `DRAFT`.
- Versão exige URI, hash SHA-256, MIME, tamanho positivo, origem; numeração sequencial automática.
- *Não fica claro no código*: transição entre `DRAFT → ACTIVE → ARCHIVED` (não há operação implementada nestes arquivos).

### 5.3 Indicadores (`indicators`)

- Definição versionada por `indicatorKey` (código não muda entre versões); exige dono, dono da qualidade, método de cálculo fechado, regra de segurança por linha, teste/tolerância de qualidade.
- **Segurança por linha**: só acessa quem tem `indicators.read-all` OU é dono OU dono da qualidade; negativa é auditada (`INDICATOR_ROW_ACCESS_DENIED`).
- **Cálculo** só sobre definição aprovada; bloqueado se já existir revisão mais recente aprovada e vigente para o período. Cada método (`PIPELINE_COUNT/VALUE`, `RESULT_CONVERSION_RATE`, `FINANCIAL_CONVERSION_RATE`, `AVERAGE_DISCOUNT/MARGIN_PERCENT`) tem regras próprias de moeda/status; denominador zero é erro explícito.
- Cada cálculo gera snapshot imutável com hash canônico dos registros-fonte.
- **Conciliação**: recalcula e compara; `MATCH` só se tudo coincidir, senão `DIVERGENT`.
- **Publicação**: só sobre conciliação `MATCH`, mais recente daquele snapshot, uma única vez; definição deve seguir aprovada e ser a mais recente. Gera `lineageHash` cobrindo definição + snapshot + conciliação.

**Fluxo:** Definição → (nova versão) → Aprovação → Cálculo (snapshot) → Conciliação → Publicação (irreversível/imutável a cada etapa).

### 5.4 Calendário (`calendar`)

- Evento exige título, início, responsável; tipos fechados (`MEETING|TRAVEL|INTERNAL_DEADLINE|PERSONAL|OTHER`).
- Horário de formulário sem fuso é sempre interpretado como Brasília (`-03:00` fixo, sem horário de verão desde 2019) antes de virar UTC.
- Vínculo de origem é exclusivo: oportunidade **OU** proposta **OU** edital, nunca mais de um.
- Evento cancelado não pode ser editado nem cancelado de novo; concorrência otimista por versão.
- Calendário mescla 3 fontes com regras de edição distintas: prazos de edital (`DEADLINE`, não editável), entregas de proposta (`DELIVERY`, não editável, só aparece se a oportunidade tem `deliveryAt`), reuniões internas (`MEETING`, editável).
- Sincronização com Microsoft Graph/Outlook é "melhor esforço" — falha externa nunca impede a operação interna; troca de responsável remove e recria o evento na agenda do novo responsável (Graph não permite transferir organizador).

**Estados:** `SCHEDULED → CANCELLED` (irreversível).

### 5.5 Central de Suporte (`support`)

- Chamado exige tipo (`BUG|QUESTION|IMPROVEMENT|NEW_FEATURE`), prioridade (padrão `NORMAL`), título (mín. 5), descrição (mín. 10).
- Triagem por IA é assíncrona e idempotente (só grava se `OPEN` e sem diagnóstico prévio); fallback determinístico se a IA falhar; severidade `CRITICAL` eleva a prioridade do chamado.
- **Política de aprovação**: mudança de classe `CONFIGURATION` com ator `OWNER` vai direto para `OWNER_ACTION_REQUIRED`; `IMPROVEMENT`/`NEW_FEATURE` (ou diagnóstico `CONFIGURATION`/`FUNCTIONAL_CHANGE`/`NEW_TOOL`) exigem aprovação prévia (`WAITING_APPROVAL`); demais vão direto para `TRIAGED`.
- **Execução automática (agente/GUULY)**: reserva (`CLAIM`) exige sem reserva ativa, <3 tentativas, e estado elegível; **limite de 3 tentativas**, esgotadas escala para `ESCALATED`; toda ação do executor exige lease+executorId correspondentes; autenticação aceita token estático (timing-safe) ou token OIDC do GitHub Actions com claims fixados.
- Conclusão → `WAITING_USER_VALIDATION`; pedido de esclarecimento decrementa tentativa (não consome); ação do proprietário necessária → `OWNER_ACTION_REQUIRED`; falha sem esgotar tentativas retorna à fila, esgotada escala.
- **Reserva expirada**: 20 minutos sem heartbeat, liberada por varredura periódica.
- **Validação do solicitante**: só o próprio `reporterId`, só em `WAITING_USER_VALIDATION`; não resolvido gera perguntas de esclarecimento (uma vez por ciclo); respostas com `resolutionAttempts ≥ 3` escalam, senão voltam para `TRIAGED` sem nova aprovação.
- **Escalonamento/reabertura**: só o proprietário decide; reabertura só de `RESOLVED`, zera todo o ciclo (tentativas, lease, esclarecimentos) e volta a `TRIAGED`.

**Estados:** `OPEN → TRIAGED/WAITING_APPROVAL/OWNER_ACTION_REQUIRED → (APPROVED) → IN_PROGRESS → WAITING_USER_VALIDATION → RESOLVED`, com desvios para `ESCALATED`, `OWNER_ACTION_REQUIRED`, `REJECTED`/`CANCELLED`.

### 5.6 Governança de IA (`ai-governance`)

- Versão de modelo exige provedor, nome, versão, tipo de serviço, região de dados, retenção, status (`ACTIVE|INACTIVE`); versionada por `modelKey`.
- Caso de uso exige código, propósito, dono, fontes autorizadas (com tipo documental + permissão exigida), critérios de avaliação, versão de modelo, prompt; só referencia modelo `ACTIVE`; versionado por `useCaseKey` (código imutável entre versões).
- Hash SHA-256 do prompt é persistido a cada versão (detecta qualquer alteração). Aprovação é evento distinto, imutável, com nota obrigatória.

### 5.7 Extração de Dados via IA (`ai-extraction`)

- Toda extração exige chave de idempotência, caso de uso, campos solicitados (deduplicados).
- Duas origens: **arquivada** (acervo, hash conferido pelo storage) e **efêmera** (bytes buscados e descartados, ex.: PNCP) — schema de origem efêmera **não é exposto na API pública** (evita SSRF e evita que o chamador declare tipo documental, o que quebraria a checagem de governança).
- **Governança obrigatória antes de qualquer chamada de IA**: caso de uso aprovado e mais recente; modelo `ACTIVE` e exatamente o vinculado ao caso de uso; provedor `OPENAI` com serviço `RESPONSES`; tipo documental da fonte autorizado pelo caso de uso; usuário com permissão exigida.
- Idempotência: mesma chave + hash diferente é rejeitado; mesma chave + mesmo hash reaproveita resultado sem nova chamada.
- Resultado é sempre assistivo — prompt do sistema instrui a IA a nunca aprovar/decidir/substituir validação humana.
- Só tipos MIME de lista branca são aceitos; resposta truncada, vazia ou com JSON inválido é falha explícita, nunca sucesso parcial.

**Estados:** `RUNNING → SUCCEEDED` ou `RUNNING → FAILED` (sem retomada); falhar só é permitido enquanto `RUNNING`.

### 5.8 Administração (`admin`)

- Usuário exige nome (mín. 3), e-mail (normalizado), status (`ACTIVE|INACTIVE|BLOCKED`); proprietário (`isOwner`) deve ser também mestre (`isMaster`) e `ACTIVE`.
- **Política de autorização hierárquica**: proprietário solicitando → direto; criar/manter proprietário sem ser proprietário → **proibido**; envolvendo usuário mestre (sem ser proprietário) → exige **aprovação do proprietário** (`OWNER_APPROVAL`); usuário comum → direto.
- Só o proprietário decide solicitação pendente, uma única vez.
- **Invariante de continuidade**: sempre deve haver ≥1 mestre ativo e ≥1 proprietário ativo — qualquer edição/exclusão que removeria o último é bloqueada.
- E-mail único no sistema; usuário não pode excluir a si mesmo; só o proprietário exclui mestre/proprietário, mestre comum pode excluir usuário comum.
- **Exclusão é lógica** (`INACTIVE` + `archivedAt`), encerra vínculos de perfil ativos.
- Vinculação de identidade Entra ID e provisionamento do Teams são "melhor esforço" — falha externa nunca bloqueia o cadastro interno.

**Estados:** Solicitação de acesso `PENDING → APPROVED/REJECTED` (irreversível). Usuário: exclusão sempre leva a `INACTIVE`; *não fica claro no código* se há caminho de reativação.

---

## 6. Referências e leitura complementar

Documentação já existente no repositório, não duplicada aqui:

- `docs/adr/0001-monolito-modular.md`, `0002-stack-i0.md`, `0003-scripts-nativos-dependencias.md` — decisões de arquitetura.
- `docs/specifications/GSIPRO-ESP-001_Modo_Analitico_Inteligente_REV00.md` e `GSIPRO-TEC-206_...` — especificação funcional/técnica detalhada do módulo de Inteligência de Oportunidade (seção 2.3).
- `docs/plans/GSIPRO-OPS-001_Plano_de_Operacao_e_Producao_REV00.md` — operação e produção.
- `docs/reports/GSIPRO-HML-701_...` e `GSIPRO-REL-070_...` — relatórios de homologação/implantação.
- `docs/manuals/GSIPRO-MAN-001_Manual_de_Suporte_para_Equipe_de_Propostas_REV00.{docx,pdf}` — manual de suporte para a equipe de propostas.
- `docs/traceability/i0..i7-status.md` — rastreabilidade de entregas por iteração.

---

*Documento gerado por análise automatizada de código-fonte em 2026-09-17. Recomenda-se regenerar após mudanças relevantes nos módulos listados.*
