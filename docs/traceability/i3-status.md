# Rastreabilidade — Incremento I3

Data de abertura: 19/07/2026  
Baseline: GSIPRO-PLN-302; GSIPRO-FUN-102, 106, 107, 108 e 113; GSIPRO-TEC-201 a 205 — revisões aprovadas

| Item | Resultado previsto | Situação |
|---|---|---|
| BL-301 | Proposta vinculada à oportunidade e edital/lote | Concluído |
| BL-302 | Versões e componentes da proposta | Concluído |
| BL-303 | Seções técnicas e responsáveis | Concluído |
| BL-304 | Evidências e revisão técnica | Concluído |
| BL-305 | Cenários comerciais reproduzíveis | Concluído |
| BL-306 | Preço, desconto e margem | Concluído |
| BL-307 | Workflow, alçadas e segregação | Concluído |
| BL-308 | Versão congelada, envio e protocolo | Concluído |

## Portão de entrada

- I2 tecnicamente concluído: sim.
- Homologação funcional I2: aprovada.
- Observação `OC-I2-001` sobre importação documental: formalizada, pendente de refinamento e programação.
- Banco exclusivo PostgreSQL 18 na porta 5433: preservado.
- Baseline de segurança, auditoria e negação por padrão: preservada.

## BL-301 concluído

- Proposta sempre pertence a uma oportunidade.
- Quando a oportunidade possui edital, versão documental e lote são obrigatórios.
- Edital, versão e lote devem pertencer à oportunidade e ao mesmo edital.
- Proposta preserva versão da oportunidade, versão documental do edital, hash da fonte e código do lote.
- Registro inicial nasce em `PREPARATION`, versão 1.
- Histórico inicial é append-only e a criação é auditada.
- Origem inconsistente ou adulterada é bloqueada também pelo PostgreSQL.
- Acesso protegido pelas permissões `proposals.read` e `proposals.create`.
- Smoke: proposta criada, vínculos e snapshots preservados, ausência de edital/lote aplicável bloqueada, adulteração de origem bloqueada, histórico imutável e auditoria confirmada.
- Validação: 105 testes em 39 arquivos, lint, tipos e build aprovados.
- Banco exclusivo PostgreSQL 18/5433 com 34 migrações e 37 permissões.
- Aplicação saudável, tela `/proposals` disponível e criação não autenticada rejeitada.

## BL-302 concluído

- Toda proposta possui uma cadeia explícita e sequencial de versões.
- A versão inicial e cada versão posterior possuem componentes `TECHNICAL` e `COMMERCIAL` independentes.
- Nova versão exige justificativa, referencia a versão anterior e retorna a proposta a `PREPARATION`.
- Versões anteriores são append-only e não podem ser alteradas ou excluídas.
- O número da versão é calculado pelo sistema e a sequência é protegida também pelo PostgreSQL.
- Criação de versão protegida pela permissão `proposals.create-version` e auditada por ator e correlação.
- A tela `/proposals` exibe o histórico, a justificativa e o estado dos dois componentes de cada versão.
- Smoke: versão 2 criada, encadeamento e dois componentes por versão confirmados, tentativa de alterar versão anterior bloqueada, histórico e auditoria confirmados.
- Validação: 111 testes em 40 arquivos, lint, tipos e build aprovados.
- Banco exclusivo PostgreSQL 18/5433 com 36 migrações e 38 permissões.
- Aplicação saudável e API de versionamento sem autenticação rejeitada com HTTP 401.

## BL-303 concluído

- Seções pertencem exclusivamente ao componente técnico da versão atual da proposta.
- Cada seção preserva tipo, título, posição positiva e única, responsável humano ativo e status controlado.
- Estados disponíveis no corte: `DRAFT`, `IN_PROGRESS`, `IN_REVIEW` e `COMPLETED`.
- Requisitos validados da versão documental da proposta podem ser associados à seção.
- O vínculo preserva versão, tipo, texto, trecho e página do requisito como snapshot imutável.
- Alterações de responsável e status usam controle otimista de versão e mantêm histórico append-only.
- Criação e alteração são auditadas com ator, correlação, proposta e versão.
- Acesso protegido pela permissão `proposals.technical-sections.manage`.
- Smoke: seção criada e ordenada, responsável ativo, status atualizado, requisito preservado, adulteração de snapshot e histórico bloqueadas e auditoria confirmada.
- Validação: 119 testes em 42 arquivos, lint, tipos e build aprovados.
- Banco exclusivo PostgreSQL 18/5433 com 38 migrações e 39 permissões.
- Aplicação saudável e API de seções técnicas sem autenticação rejeitada com HTTP 401.

## BL-304 concluído

- Conteúdo técnico é salvo em cadeia de versões append-only, com justificativa e hash SHA-256.
- Somente o responsável atual da seção pode elaborar conteúdo e vincular evidências.
- Evidências apontam para registro técnico e versão documental específicos, preservando tipo, número, versão e hash da fonte.
- Comentários de revisão distinguem pendências normais e críticas e exigem resolução humana registrada.
- Revisões humanas referenciam a versão mais recente do conteúdo e são append-only.
- Aprovação exige conteúdo, ao menos uma evidência e ausência de comentários abertos.
- Pendência crítica bloqueia conclusão; novo conteúdo, evidência ou comentário invalida aprovação anterior.
- Seção concluída exige revisão técnica aprovada também no PostgreSQL.
- Acesso protegido pelas permissões `proposals.technical-content.edit` e `proposals.technical-review`.
- Smoke: conteúdo, evidência, pendência crítica, bloqueio, resolução, aprovação, hashes, imutabilidade e auditoria confirmados.
- Validação: 132 testes em 44 arquivos, lint, tipos e build aprovados.
- Banco exclusivo PostgreSQL 18/5433 com 40 migrações e 41 permissões.
- Aplicação saudável e API de revisão sem autenticação rejeitada com HTTP 401.

## BL-305 concluído

- Cenários comerciais preservam moeda, data-base, fonte do valor estimado, premissas e itens detalhados.
- Cada revisão cria nova versão encadeada; cenários anteriores são append-only.
- O hash do cálculo permite reproduzir e verificar exatamente os dados utilizados.

## BL-306 concluído

- Custo total, preço ofertado, desconto e margem são calculados com precisão decimal pela fórmula versionada `GSIPRO-CALC-001`.
- A aplicação não permite à IA definir preço, desconto, margem ou limites decisórios.
- Valores enviados e componentes do cálculo ficam preservados no cenário aprovado.

## BL-307 concluído

- Alçadas são regras explícitas, versionadas, com vigência, moeda, faixas e permissão obrigatória.
- Nenhum limite nominal foi presumido; a regra usada no teste é identificada como sintética.
- Autoaprovação é bloqueada e a decisão exige aprovador ativo, autorizado e segregado do criador.
- Decisões, justificativas e transições do workflow são imutáveis e auditáveis.

## BL-308 concluído

- O envio exige versão atual, cenário aprovado e todas as seções técnicas concluídas.
- O pacote enviado congela proposta, versão, cenário, aprovação e hashes das seções técnicas.
- Canal, data/hora, protocolo, evidência documental e hashes do pacote são preservados.
- Após o envio, a proposta alcança `SENT` e o registro não pode ser alterado ou excluído.
- Smoke oficial confirmou as 12 invariantes do fluxo comercial e de submissão, incluindo congelamento técnico pós-envio.
- Validação final: 144 testes em 46 arquivos, lint, tipos e build aprovados.
- Banco exclusivo PostgreSQL 18/5433 com 45 migrações e 46 permissões.

## Encerramento do incremento

Incremento I3 formalmente concluído: 8 de 8 blocos entregues, verificação funcional assistida executada e homologação aprovada pelo responsável do projeto em 19/07/2026.

## Regras preservadas

- Dados mínimos ausentes mantêm o registro em rascunho ou bloqueiam transição crítica.
- Nenhuma alçada, SLA, prazo legal, fórmula ou retenção será presumida.
- Criação, acesso e vínculos críticos serão autorizados e auditados.
