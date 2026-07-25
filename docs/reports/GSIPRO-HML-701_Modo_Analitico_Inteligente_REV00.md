# GSIPRO-HML-701 — Homologação do Modo Analítico Inteligente

- Revisão: REV00
- Data da avaliação: 24/07/2026
- Escopo: incrementos T0 a T6
- Ambiente avaliado: código-fonte local e Azure Container Apps HML
- Responsável técnico: Codex
- Aprovação do proprietário: pendente
- Resultado do portão: **BLOQUEADO PARA PRODUÇÃO**

## 1. Conclusão executiva

Os incrementos T0 a T6 possuem fundação técnica coerente e passaram pelas verificações automatizadas locais. Durante a homologação foi identificado e corrigido um bloqueio de segurança nas dependências: o inventário inicial continha 3 vulnerabilidades críticas e 12 altas; após atualização controlada, a auditoria de produção passou a indicar 0 críticas e 0 altas.

O painel visual foi implementado localmente após a primeira emissão deste relatório. Ele inclui resumo executivo, perspectivas Comercial, Técnica e Estudos, cards detalháveis, gráfico climático com tabela equivalente, rotas sob carregamento controlado, proteção de dados financeiros e painéis laterais operáveis por teclado.

O recurso ainda não pode ser homologado para produção porque:

1. acessibilidade e experiência de uso precisam de validação manual com usuários autenticados no ambiente HML;
2. as integrações climática, Google Routes, Google Maps e e-mail ainda dependem de credenciais, permissões, quotas e testes controlados no ambiente de homologação;
3. o cenário real autorizado identificou ausência de política de inteligência aprovada e vigente;
4. a política de segurança por linha da oportunidade ainda precisa de validação funcional no ambiente corporativo;
5. a aprovação final do proprietário ainda não foi registrada.

Este resultado não invalida T0 a T6. Ele preserva o critério de que “estrutura implementada” não significa “produção homologada”.

## 2. Evidências e portão

| Área obrigatória | Situação | Evidência | Próxima ação | Responsável |
|---|---|---|---|---|
| Segurança | APROVADA LOCALMENTE | Auditoria de dependências: 0 críticas e 0 altas; autenticação, permissões específicas, validação e auditoria presentes | Validar segurança por linha e executar teste de autorização no ambiente HML | Técnico + proprietário |
| Funcional | APROVADA LOCALMENTE | Prisma, lint, tipos, testes automatizados e build de produção executados | Executar roteiro funcional no painel visual | Técnico + usuários autorizados |
| Desempenho | BLOQUEADA | Há paginação, lotes, timeouts e processamento controlado, mas não houve ensaio de carga representativo | Definir volume esperado e executar carga em HML | Técnico |
| Resiliência | PARCIAL | Idempotência, outbox, repetição limitada e testes simulados implementados | Validar indisponibilidade e retomada com provedores reais em HML | Técnico |
| Custo | PARCIAL | Uso sob demanda, field masks, carregamento tardio do mapa e lotes limitam consumo | Configurar quotas, alertas e orçamento antes de ativar APIs | Proprietário + administrador Azure/Google |
| Acessibilidade | PARCIAL | Interface possui semântica, teclado, fechamento por Escape, anúncio de estado, gráfico com tabela equivalente e mapa com resumo textual | Validar foco, contraste, zoom, responsividade e leitores de tela com sessão autenticada em HML | Design + técnico + usuários |
| Integrações externas | BLOQUEADA | Adaptadores e testes simulados existem; credenciais e consentimentos reais não foram validados | Configurar segredos e executar contratos sem dados sensíveis | Administradores + técnico |
| Cenários reais autorizados | PARCIAL | O proprietário autorizou o uso da oportunidade ativa PPB_002; o sistema bloqueou corretamente o processamento por ausência de política de inteligência aprovada e vigente | Definir, revisar e aprovar a política do Modo Analítico antes de repetir o teste | Proprietário + área de propostas |
| Aprovação do proprietário | PENDENTE | Não registrada | Aprovar somente após eliminar os bloqueios | Proprietário |

## 3. Correções de segurança realizadas

Atualizações aplicadas:

- Next.js `16.2.10` para `16.2.11`;
- Auth.js/NextAuth `5.0.0-beta.31` para `5.0.0-beta.32`;
- `@auth/core` atualizado transitivamente para versão corrigida;
- SheetJS `0.18.5` substituído pelo pacote oficial `0.20.3`;
- substituições transitivas controladas para `fast-uri 3.1.4`, `postcss 8.5.23` e `sharp 0.35.3`.

Resultado da auditoria de produção após correção:

```text
críticas: 0
altas: 0
moderadas: 3
baixas: 0
```

As vulnerabilidades moderadas devem permanecer monitoradas, mas não ultrapassam o limiar de bloqueio adotado nesta revisão.

## 4. Critérios para destravar a produção

O portão somente poderá retornar `APPROVED` quando todas as áreas obrigatórias estiverem em `PASS` e houver aprovação explícita do proprietário. O domínio contém uma regra automatizada para impedir aprovação por omissão de evidência, falha ou bloqueio.

Sequência mínima:

1. validar o painel visual autenticado conforme GSIPRO-ESP-001;
2. validar WCAG 2.2 nível AA e o padrão visual aprovado;
3. configurar credenciais e quotas em HML;
4. validar segurança por perfil, dado e oportunidade;
5. executar carga e falhas transitórias com limites acordados;
6. testar oportunidades reais autorizadas, sem envio indevido de notificações;
7. registrar aceite dos usuários;
8. solicitar aprovação final do proprietário;
9. somente então preparar publicação.

## 5. Referenciais

- [W3C — Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/)
- [OWASP — Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
- [Google Routes API — Usage and billing](https://developers.google.com/maps/documentation/routes/usage-and-billing)
- [Azure Container Apps — Billing](https://learn.microsoft.com/en-us/azure/container-apps/billing)

## 6. Registro da execução automatizada

| Verificação | Resultado |
|---|---|
| Prisma | esquema válido |
| ESLint | aprovado, zero avisos |
| TypeScript | aprovado |
| Vitest | 92 arquivos e 299 testes aprovados |
| Build Next.js 16.2.11 | aprovado, 49 páginas estáticas geradas |
| Auditoria de produção | 0 críticas, 0 altas, 3 moderadas |
| Integridade do diff | aprovada |

O build manteve um aviso conhecido do Turbopack sobre rastreamento amplo originado em `document-storage.ts`. Ele não impediu a compilação, mas deve ser tratado como melhoria técnica antes da otimização definitiva da imagem de produção.

## 7. Prontidão das integrações

O painel passou a avaliar, em tempo de execução e sem retornar valores sensíveis, a prontidão de:

- fonte climática;
- Google Routes;
- Google Maps incorporado;
- notificações no Microsoft Teams;
- notificações por e-mail.

Para cada integração incompleta, o proprietário ou administrador cloud recebe:

- indicação de que existe ação administrativa pendente;
- responsável esperado;
- procedimento de menor privilégio;
- próximo teste controlado.

Chaves, tokens e segredos não são exibidos no navegador, registrados na auditoria ou incluídos no resultado da verificação.

Na avaliação local inicial não houve alteração no Azure nem teste com oportunidade real. A publicação posterior está registrada na seção 8 após autorização explícita do proprietário. O teste controlado posterior está registrado na seção 9.

## 8. Publicação HML autorizada

O proprietário autorizou a configuração e publicação no Azure HML em 24/07/2026.

Evidências da publicação:

- imagem: `acrgsiprohml27207f.azurecr.io/gsipro:analytics-ui-20260724-01`;
- revisão: `ca-gsipro-hml-aahbrant--0000009`;
- estado da revisão: `Healthy`;
- provisionamento: `Provisioned`;
- versão respondida: `0.1.0-analytics-ui-20260724-01`;
- banco de dados: `available`;
- endereço: `https://ca-gsipro-hml-aahbrant.thankfulpond-8424c61a.brazilsouth.azurecontainerapps.io/`.

O pacote enviado ao ACR excluiu `.env`, dados locais, documentos importados, histórico Git, dependências e artefatos de compilação. A pasta temporária de empacotamento foi removida após a publicação.

Permanecem como `OWNER_ACTION_REQUIRED` as integrações cujas credenciais ou contratos não existem no Container App:

- provedor climático;
- Google Routes;
- Google Maps incorporado;
- remetente e consentimentos de notificação externa.

Nenhum valor foi inventado e nenhum controle de segurança foi reduzido.

## 9. Teste controlado com oportunidade real

Em 24/07/2026, o proprietário autorizou a seleção de uma oportunidade existente para validação em HML. Foi escolhida a oportunidade ativa `PPB_002`, com execução limitada às etapas internas e sem consumo das integrações externas pendentes.

Resultados:

- autenticação corporativa concluída com perfil Proprietário;
- painel do Modo Analítico carregado na oportunidade correta;
- prontidão do Microsoft Teams apresentada como `Pronto`;
- clima, Google Routes, Google Maps e e-mail apresentados como `Ação necessária`, com responsável e orientação;
- comando `Iniciar análise` recusado com a mensagem `Nenhuma política de inteligência aprovada e vigente foi encontrada`;
- comando `Capacidade operacional` sujeito ao mesmo bloqueio;
- nenhuma análise, versão analítica ou resultado artificial foi criado;
- nenhuma API climática, Google, e-mail ou outra integração tarifável foi acionada.

A governança existente foi inspecionada em modo somente leitura. Há um caso de uso aprovado para reconhecimento de acervo técnico, mas não existe política aprovada para o Modo Analítico de oportunidades. O comportamento observado é seguro e coerente: o sistema não decide sem critérios formalmente aprovados.

Próximo portão: elaborar a política do Modo Analítico com critérios, pesos, limiares, fontes e responsáveis; submeter à aprovação do proprietário; somente depois repetir o teste da `PPB_002`.

## 10. Fluxo de cadastro e aprovação publicado

Foi publicada em HML a interface administrativa para tratar o portão identificado na seção 9.

Evidências:

- imagem: `acrgsiprohml27207f.azurecr.io/gsipro:analytics-policy-ui-20260724-01`;
- revisão: `ca-gsipro-hml-aahbrant--0000010`;
- estado da revisão: `Healthy`;
- versão respondida: `0.1.0-analytics-policy-ui-20260724-01`;
- tela autenticada: `Administrador → Aprovações → Política analítica`;
- formulário inicial com pesos propostos de 35% Comercial, 40% Técnica e 25% Estudos;
- faixas propostas de 80 pontos para `RECOMENDADO` e 60 pontos para `RECOMENDADO_COM_RESSALVAS`;
- confiança e cobertura mínimas de 70%;
- impedimentos críticos preservados;
- tabela de versões, autor, situação e aprovação;
- contador global de políticas pendentes.

A segregação de funções foi mantida: usuário mestre registra a proposta e um proprietário diferente do autor a aprova. A publicação não criou nem aprovou uma política em nome de terceiros.

Após autorização posterior do proprietário, a política `Modo Analítico Inteligente · v1` foi registrada por Gutemberg Pontes com os parâmetros propostos e permaneceu em `Aguardando proprietário`. Como o autor não pode aprovar a própria política, a decisão deve ser registrada por Wellington Loureço, o outro proprietário cadastrado. O bloqueio foi apresentado corretamente na interface.

## 11. Atualização funcional publicada em 25/07/2026

Após a aprovação da política e a evolução da interface, foram publicados incrementos adicionais no mesmo ambiente HML:

- separação do detalhe da oportunidade em resumo, documentos e Modo Analítico;
- preenchimento assistido de local, coordenadas e período somente a partir dos documentos vinculados à própria oportunidade, sempre sujeito a confirmação humana;
- apresentação de pedágios por rota, sem tratar ausência do dado como custo zero;
- cadastro formal de capacidade financeira da oportunidade;
- cadastro formal do desempenho de pagamento do cliente ou órgão vinculado;
- decisão empresarial no próprio painel, com exigência de proprietário para superar recomendação negativa ou impedimento crítico;
- cadastro administrativo de bases operacionais para os estudos de rota;
- central persistente de notificações, contador de não lidas, próxima ação e deep link autenticado.

Evidências de versionamento e publicação:

| Incremento | Commit | Revisão HML | Resultado |
|---|---|---|---|
| Contexto documental assistido | `88d6fa0` | `0000018` | saudável, 100% do tráfego durante sua ativação |
| Avaliações financeiras formais | `a582610` | `0000019` | saudável, 100% do tráfego durante sua ativação |
| Decisão empresarial | `6880422` | `0000020` | saudável, 100% do tráfego durante sua ativação |
| Bases operacionais e notificações | `b8ad6bc` | `0000021` | saudável, ativa e com 100% do tráfego |

Verificações automatizadas da versão consolidada:

- 99 arquivos de teste e 322 testes aprovados;
- ESLint aprovado sem avisos;
- TypeScript aprovado;
- construção de imagem no Azure Container Registry concluída;
- integridade do diff aprovada.

Continuam bloqueados, sem uso de valores inventados:

1. fonte e credenciais da API climática;
2. credenciais, faturamento e quotas do Google Routes e Google Maps Embed;
3. remetente, consentimentos e token de despacho das notificações externas;
4. fórmula empresarial do custo de mobilização;
5. ensaios de carga, resiliência, WCAG 2.2 AA e testes com oportunidades reais autorizadas;
6. aprovação explícita do proprietário para produção.
