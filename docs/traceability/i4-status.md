# Rastreabilidade — Incremento I4

Data de abertura: 19/07/2026  
Baseline: GSIPRO-PLN-302; GSIPRO-FUN-109, 110, 113 e 114; GSIPRO-TEC-201 a 205 — revisões aprovadas

| Item | Resultado previsto | Situação |
|---|---|---|
| BL-401 | Concorrentes, participantes e ofertas por lote | Concluído |
| BL-402 | Julgamentos, diligências e recursos | Concluído |
| BL-403 | Resultado validado e motivo governado | Concluído |
| BL-404 | Catálogo versionado de indicadores | Concluído |
| BL-405 | Pipeline, conversão e desempenho | Concluído |
| BL-406 | Conciliação analítica com dados operacionais | Concluído |
| BL-407 | Segurança de dados e linhas | Concluído |
| BL-408 | Atualização, qualidade e rastreabilidade | Concluído |

## Portão de entrada

- I3 formalmente encerrado e homologado: sim.
- FUN-109 e FUN-110 aprovados e representados no backlog: sim.
- Segurança, auditoria, negação por padrão e banco exclusivo 5433: preservados.
- Fórmulas, SLAs e tolerâncias nominais ainda não aprovados: não serão presumidos.
- Power BI externo: integração somente após contrato próprio; o I4 começa pelo modelo operacional e analítico rastreável.

## Corte ativo

Incremento I4 concluído e homologado funcionalmente pelo responsável do projeto em 19/07/2026. O I5 foi aberto de forma controlada pelo BL-501.

Regra transversal: edital, TR, ETP e demais documentos devem ingressar por upload do arquivo original. Hashes são calculados no servidor; metadados manuais apenas complementam a fonte. Decisão registrada em GSIPRO-REL-052.

Adequação concluída: armazenamento imutável configurável, SHA-256 calculado no servidor e upload real incorporados aos editais, suas versões e documentos administrados. Validação com 154 testes em 49 arquivos, lint, tipos e build; banco com 47 migrações. Conclusão registrada em GSIPRO-REL-053.

## Primeiro corte do BL-401

- Modelo físico de concorrência, identidade de concorrente, participante por lote e oferta versionada criado.
- Vínculo entre edital e lote validado também pelo PostgreSQL.
- Ofertas preservam valor decimal, moeda, data, fonte e condição `ESTIMATED` ou `CONFIRMED`.
- Nova informação de oferta cria versão encadeada; atualização e exclusão do histórico são bloqueadas.
- Duplicidade do mesmo participante no lote é bloqueada, sem consolidação silenciosa.
- Acesso protegido por `competitions.read` e `competitions.manage`.
- Três APIs protegidas e a interface funcional `/competitions` foram incorporadas.
- Smoke oficial: 9 de 9 invariantes confirmadas.
- Validação: 152 testes em 48 arquivos, lint, tipos e build aprovados.
- Banco exclusivo PostgreSQL 18/5433 com 46 migrações e 48 permissões.
- Verificação autenticada confirmou concorrência, participante, fontes, oferta estimada v1 e oferta confirmada v2; navegador sem erros.

## Regras preservadas

- Participante é registrado por lote e possui identidade controlada.
- Toda oferta registra moeda, valor, data, fonte e condição de confirmação.
- Oferta posterior não apaga a versão anterior.
- Duplicidade ou conflito impede consolidação silenciosa.
- Dados mínimos ausentes mantêm rascunho ou bloqueiam transição crítica.
- Acesso e alterações críticas são autorizados e auditados.
- Documento obrigatório não pode ser substituído por cadastro manual isolado; o original enviado e suas versões devem ser preservados.

## Segundo corte — BL-402

- Julgamento registra participante, classificação, habilitação, critério e evidência documental.
- Diligência, recurso e contrarrazão exigem prazo; decisão preserva sua fonte.
- Todos os atos mantêm data, fonte, documento, hash, ator e correlação.
- Revisões criam versões encadeadas; atualização e exclusão do histórico são bloqueadas.
- Participante deve pertencer à concorrência e o hash deve corresponder à versão documental.
- Validação: 158 testes em 49 arquivos, lint, tipos e build aprovados.
- Banco exclusivo com 48 migrações; smoke de 3 atos confirmou versões, hash, imutabilidade e auditoria.
- Conclusão formal registrada em GSIPRO-REL-054.

## Terceiro corte — BL-403

- Resultado registra ganho, perda, desclassificação ou cancelamento, categoria, justificativa, fonte e documento.
- Catálogo de motivos possui código estável, definição, aplicabilidade, situação, motivo da mudança e versões imutáveis.
- O autor não valida o próprio resultado; validador ativo e autorizado é obrigatório.
- Somente a versão mais recente, com categoria ativa mais recente, pode ser validada.
- Resultado sem validação permanece fora da condição oficial para indicadores.
- Validação: 161 testes em 49 arquivos, lint, tipos e build aprovados.
- Banco exclusivo com 49 migrações e 49 permissões; smoke confirmou todos os controles críticos.
- Conclusão formal registrada em GSIPRO-REL-055.

## Quarto corte — BL-404

- Catálogo registra código, finalidade, proprietário, fórmula, granularidade, fontes, dimensões, atualização, segurança e qualidade.
- Fórmulas não são inferidas: cada parte é declarada e submetida à aprovação.
- Revisão mantém código estável, encadeia versões e registra vigência e motivo.
- Somente a versão mais recente pode ser aprovada; autor e aprovador devem ser pessoas distintas.
- Definições e aprovações são imutáveis e auditadas.
- Validação: 167 testes em 51 arquivos, lint, tipos e build aprovados.
- Banco exclusivo com 50 migrações e 52 permissões; smoke confirmou versões, segregação e auditoria.
- Conclusão formal registrada em GSIPRO-REL-056.

## Quinto corte — BL-405

- Cada nova definição seleciona explicitamente um dos seis métodos executáveis: quantidade ou valor do pipeline, conversão por resultado, conversão financeira, desconto médio ou margem média.
- O cálculo só executa sobre definição aprovada e vigente; definição legada sem método exige revisão, sem interpretação automática da fórmula textual.
- Período e moeda são explícitos, somas usam precisão decimal e denominador vazio bloqueia a publicação do resultado.
- Conversão de resultado considera apenas resultados com validação humana; conversão financeira exige valor contratual vinculado a ganho validado e evidência documental com hash conferido.
- Cada execução gera snapshot imutável com numerador, denominador, valor, unidade, fontes permitidas, SHA-256, ator e correlação.
- A interface `/indicators` permite calcular e consultar snapshots; `/competitions` registra o valor conquistado somente após ganho validado.
- Validação: 169 testes em 51 arquivos, lint, tipos e build aprovados.
- Banco exclusivo com 51 migrações e 53 permissões; smoke confirmou hash, método, persistência, reprodutibilidade, imutabilidade e auditoria.
- Conclusão formal registrada em GSIPRO-REL-057.

## Sexto corte — BL-406

- Cada conciliação parte de um snapshot imutável e produz um novo recálculo independente com a mesma definição, período e moeda.
- A comparação exata verifica numerador, denominador, valor, quantidade de fontes e SHA-256 do conjunto operacional.
- Sem tolerância numérica aprovada, qualquer diferença resulta em `DIVERGENT`; igualdade integral resulta em `MATCH`.
- O PostgreSQL impede conciliação entre métodos, períodos, moedas ou definições incompatíveis e confere as diferenças registradas.
- Conciliações são append-only, possuem nota, ator, horário e correlação, e não alteram nem corrigem snapshots automaticamente.
- Permissão específica `indicators.reconcile` protege a nova API e a ação exibida em `/indicators`.
- Validação: 171 testes em 51 arquivos, lint, tipos e build aprovados.
- Banco exclusivo com 52 migrações e 54 permissões; smoke confirmou recálculo independente, igualdade de hash, diferenças zero, imutabilidade e auditoria.
- Conclusão formal registrada em GSIPRO-REL-058.

## Sétimo corte — BL-407

- A permissão `indicators.read` passou a operar com escopo de linha: somente proprietário ou responsável de qualidade consulta o indicador e seus snapshots.
- A permissão separada `indicators.read-all` concede leitura integral somente ao perfil administrativo aprovado.
- Revisão, aprovação, cálculo e conciliação verificam o mesmo escopo antes da operação.
- Negação de linha usa mensagem genérica, não revela a existência do recurso e registra evento `DENIED` com ação solicitada e correlação.
- Snapshots e conciliações herdam o escopo da definição, sem expor origens operacionais a usuário não autorizado.
- Validação: 176 testes em 52 arquivos, lint, tipos e build aprovados.
- Banco exclusivo com 53 migrações e 55 permissões; smoke confirmou ausência de linhas para terceiro, bloqueio operacional, auditoria da negação e leitura integral administrativa explícita.
- Conclusão formal registrada em GSIPRO-REL-059.

## Oitavo corte — BL-408

- Publicação exige a conciliação `MATCH` mais recente do snapshot e a definição aprovada mais recente.
- O registro oficial referencia o snapshot observado, preserva a data real da atualização e registra estado de qualidade, nota, publicador e correlação.
- Hash SHA-256 de linhagem reúne definição, método, período, moeda, snapshot, conjunto operacional e conciliação.
- Publicações são append-only e o PostgreSQL impede publicação divergente, desatualizada ou vinculada a snapshot incompatível.
- A interface exibe estado publicado, última atualização, horário da publicação e hash de linhagem.
- Nenhuma periodicidade, SLA ou tolerância nominal foi presumida.
- Validação: 177 testes em 52 arquivos, lint, tipos e build aprovados.
- Banco exclusivo com 54 migrações e 56 permissões; smoke confirmou publicação do snapshot observado, qualidade, atualização exata, linhagem, imutabilidade e auditoria.
- Conclusão formal do BL-408 e encerramento técnico do I4 registrados em GSIPRO-REL-060.

## Encerramento técnico

Incremento I4 concluído e homologado em 19/07/2026: 8 de 8 blocos entregues. Homologação registrada em GSIPRO-REL-061; abertura do I5 registrada em GSIPRO-REL-062.
