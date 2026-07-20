# Rastreabilidade — Incremento I2

Data de abertura: 19/07/2026  
Baseline: GSIPRO-PLN-302 REV00 APROVADO; GSIPRO-FUN-104 e GSIPRO-FUN-105 REV00 APROVADOS

| Item | Resultado previsto | Situação |
|---|---|---|
| BL-201 | Contratos, obras e serviços executados | Concluído |
| BL-202 | Atestados, CATs, ARTs e versões | Concluído |
| BL-203 | Profissionais e vínculos protegidos | Concluído |
| BL-204 | Pesquisa por características e quantitativos | Concluído |
| BL-205 | Matriz a partir de requisitos validados | Concluído |
| BL-206 | Evidências e comparação de quantitativos | Concluído |
| BL-207 | Lacunas, riscos e validação técnica | Concluído |
| BL-208 | Versionamento e exportação da matriz | Concluído |

## Portão de entrada

- I1 tecnicamente concluído: sim.
- Roteiro de homologação funcional emitido: sim.
- Aceite humano do I1: pendente de registro.
- Desenvolvimento do BL-201 pode iniciar sem promover o I2 a homologado.

## BL-201 concluído

- Cadastro hierárquico de contrato, obra, serviço e quantitativo implementado.
- Texto original, fonte, unidade, períodos, valor, responsável e evidência documental preservados.
- Estados `DRAFT`, `VALIDATED`, `RESTRICTED` e `EXPIRED` disponíveis.
- Histórico técnico append-only, vínculo documental e auditoria transacional confirmados.
- Smoke integrado: 1 contrato, 1 obra, 1 serviço, 1 quantitativo, 1 histórico, 1 vínculo e 1 evento de auditoria.
- Validação: 65 testes em 23 arquivos, lint, tipos e build aprovados.
- Banco exclusivo PostgreSQL 18/5433 com 19 migrações e 25 permissões.

## BL-202 concluído

- Atestado, CAT e ART cadastrados como tipos distintos e sem equivalência presumida.
- Cada registro aponta para uma versão documental imutável, com hash e origem preservados.
- Validade, restrições, emissor, objeto ou atividade, profissional e período modelados conforme o tipo.
- Versionamento append-only com cadeia validada no banco.
- ART pode apontar somente para CAT da mesma experiência.
- Smoke integrado: 1 atestado, 2 versões de CAT, 1 ART, 4 vínculos documentais e 4 eventos de auditoria.
- Validação: 70 testes em 25 arquivos, lint, tipos e build aprovados.
- Banco exclusivo PostgreSQL 18/5433 com 21 migrações e 25 permissões.

## BL-203 concluído

- Cadastro mestre limitado a nome profissional, conselho, registro, RNP opcional e título.
- CPF, endereço, telefone e e-mail não integram o modelo e são rejeitados pela validação de entrada.
- Finalidade, base legal, classificação `PERSONAL_DATA` e situação são obrigatórias.
- Vínculos N:N disponíveis para contrato, obra, CAT e ART, com função, responsabilidade e período.
- Todo vínculo exige uma versão documental comprobatória.
- Vínculos com documentos técnicos aceitam somente CAT ou ART; atestado não é presumido como equivalente.
- Consulta e criação protegidas por permissões próprias e acesso negado por padrão.
- Consultas de dados profissionais e criações geram eventos de auditoria sem documento integral.
- Histórico e vínculos são append-only.
- Smoke integrado: 1 profissional, 2 vínculos, 1 histórico, 2 vínculos documentais e auditoria de criação/acesso.
- Validação: 75 testes em 27 arquivos, lint, tipos e build aprovados.
- Banco exclusivo PostgreSQL 18/5433 com 23 migrações e 27 permissões.

## BL-204 concluído

- Pesquisa controlada por disciplina, descrição original do serviço, característica, unidade e faixa quantitativa.
- A pesquisa quantitativa exige unidade explícita e não realiza conversão automática.
- Resultado preserva texto original, todos os quantitativos cadastrados, fontes, contrato, obra e evidência documental com versão e hash.
- Pelo menos um filtro é obrigatório e a paginação é limitada a 50 registros para impedir extração indiscriminada.
- Acesso protegido pela permissão específica `technical-archive.search`, com negação por padrão.
- Toda pesquisa gera auditoria com ator, correlação, filtros utilizados e contagem, sem armazenar os termos brutos.
- Smoke integrado confirmou correspondência por disciplina, serviço, característica e faixa quantitativa, com fonte e evidência rastreáveis.
- Validação: 81 testes em 29 arquivos, lint, tipos e build aprovados.
- Banco exclusivo PostgreSQL 18/5433 com 24 migrações e 28 permissões.

## BL-205 concluído

- Requisito pode ser formalmente validado somente depois de possuir ao menos uma análise humana e todas estarem validadas.
- Alteração posterior de requisito validado o reabre automaticamente como `PENDING_VALIDATION`.
- Matriz inicial vinculada à versão do edital, usando a modalidade de versão de análise prevista no TEC-202 enquanto o módulo de propostas do BL-301 não existe.
- Criação bloqueada se houver requisito em rascunho ou pendente de validação na versão do edital.
- Todos os requisitos validados da fonte são copiados para itens rastreáveis com versão, tipo, texto, criticidade, trecho e página.
- Hash da versão documental, quantidade de itens, histórico e correlação são preservados.
- Itens e histórico são append-only, com proteção também no banco.
- Acesso, criação e validação protegidos por três permissões específicas e auditados.
- Smoke integrado: matriz v1 em análise, 2 itens, 1 histórico, hash preservado, 1 auditoria de criação e 2 auditorias de validação; tentativa de alteração do item bloqueada.
- Validação: 86 testes em 31 arquivos, lint, tipos e build aprovados.
- Banco exclusivo PostgreSQL 18/5433 com 26 migrações e 31 permissões.

## BL-206 concluído

- Cada item da matriz aceita zero ou mais evidências técnicas versionadas.
- A mesma evidência técnica não pode ser associada duas vezes ao mesmo item.
- Associação preserva tipo, número, versão, situação, versão documental, hash, localizador e justificativa.
- Comparação preserva quantitativo e unidade exigidos, quantitativo e unidade comprovados, valor normalizado e diferença.
- Unidades iguais proíbem conversão; unidades diferentes exigem fator, regra e fonte documentados.
- O quantitativo comprovado deve pertencer à mesma experiência vinculada à evidência técnica.
- Valores, unidades, hashes e origens são confirmados também por gatilhos de banco.
- Evidências e comparações são append-only.
- Associação protegida pela permissão `compliance-matrices.associate-evidence` e auditada.
- Smoke integrado: 3 evidências, 2 comparações, 1 conversão documentada, diferença de 250,5, duplicidade e alteração bloqueadas, 3 auditorias e hashes preservados.
- Validação: 90 testes em 33 arquivos, lint, tipos e build aprovados.
- Banco exclusivo PostgreSQL 18/5433 com 28 migrações e 32 permissões.

## BL-207 concluído

- Cada validação técnica registra decisão humana: atende, atende parcialmente, não atende ou não aplicável.
- Justificativa técnica é obrigatória em todos os resultados.
- Decisões positivas exigem ao menos uma evidência associada.
- Resultado parcial ou não atende exige lacuna, risco, impacto, tratamento, responsável ativo e prazo informado.
- O sistema não cria SLA ou prazo legal presumido.
- Cada validação captura a lista exata e os hashes das evidências consideradas.
- Nova evidência torna a validação anterior visivelmente sujeita a revalidação.
- Revalidações criam versões encadeadas; registros anteriores permanecem append-only.
- Acesso protegido pela permissão `compliance-matrices.validate-item` e auditado.
- Smoke integrado: 3 validações, 2 versões de revalidação, nova evidência detectada, conclusão positiva sem evidência bloqueada, tratamento completo, alteração bloqueada, 3 auditorias e snapshots preservados.
- Validação: 95 testes em 35 arquivos, lint, tipos e build aprovados.
- Banco exclusivo PostgreSQL 18/5433 com 30 migrações e 33 permissões.
- Aplicação saudável e rota de validação protegida contra acesso não autenticado.

## BL-208 concluído

- Consolidação permitida somente quando todos os itens possuem validação humana atualizada.
- Nova evidência pendente de revalidação bloqueia a consolidação.
- A exportação JSON canônica preserva versão da matriz, edital e hash da fonte, requisitos, evidências, versões documentais, quantitativos, conversões, lacunas, riscos e todas as validações.
- Cada arquivo possui hash SHA-256 persistido e novamente verificado no download.
- Consolidação é idempotente e não cria exportações duplicadas na repetição segura.
- Matriz validada, histórico e exportação permanecem imutáveis.
- Acesso protegido pelas permissões `compliance-matrices.finalize` e `compliance-matrices.export` e auditado.
- Smoke integrado: matriz validada, 1 exportação, versão e fonte preservadas, 2 itens, evidências e validações presentes, hash confirmado, alteração e associação posterior bloqueadas, 2 versões de histórico e 3 auditorias.
- Validação: 100 testes em 37 arquivos, lint, tipos e build aprovados.
- Banco exclusivo PostgreSQL 18/5433 com 32 migrações e 35 permissões.
- Aplicação saudável e rotas de consolidação/exportação protegidas contra acesso não autenticado.

## Encerramento

Incremento I2 tecnicamente concluído e homologado funcionalmente pelo responsável pelo projeto em 19/07/2026. Próxima ação: formalizar a observação de importação documental e abrir o incremento I3 conforme o backlog aprovado.
