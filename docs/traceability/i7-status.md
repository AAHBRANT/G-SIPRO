# Rastreabilidade — Incremento I7 — Modo Analítico Inteligente

Data de abertura: registro retroativo em 25/07/2026 — a construção já estava concluída estruturalmente quando este documento foi redigido; não existia até então nenhum registro no padrão `i0` a `i5` para este incremento, apesar de já existirem especificação (`GSIPRO-ESP-001`), detalhamento técnico (`GSIPRO-TEC-206`) e relatório de homologação (`GSIPRO-HML-701`) próprios.

Baseline: `GSIPRO-ESP-001_Modo_Analitico_Inteligente_REV00` (aprovada pelo proprietário em 24/07/2026); `GSIPRO-TEC-206_Modo_Analitico_Inteligente_REV00`.

| Item | Resultado previsto | Situação |
|---|---|---|
| BL-701 (T0) | Estrutura base: análise, políticas de inteligência e bases operacionais | Concluído |
| BL-702 (T3) | Estudo climático | Concluído |
| BL-703 (T4) | Estudo de rotas e logística | Concluído |
| BL-704 (T5) | Avaliação financeira e de risco de pagamento do cliente | Concluído |
| BL-705 (T6) | Central de notificações | Concluído |
| BL-706 | Decisão humana obrigatória para avançar com a oportunidade | Concluído |
| BL-707 | Portão de homologação (`homologation-gate`) | Concluído estruturalmente; homologação **bloqueada** |

## Portão de entrada

- I5 concluído e homologado: sim.
- Especificação `GSIPRO-ESP-001` aprovada pelo proprietário: sim (24/07/2026).
- Execução autônoma de decisão, alçada, desconto, margem, prazo ou envio: proibida — confirmado no código (`OpportunityAnalysisDecisionService` exige decisão humana explícita e justificada).

## BL-701 a BL-705 — dimensões analíticas

- Cada oportunidade recebe pontuação de 0 a 100, recomendação (`RECOMENDADO` / `RECOMENDADO_COM_RESSALVAS` / `NAO_RECOMENDADO`), fatores favoráveis/desfavoráveis, impedimentos críticos e itens pendentes — nunca inventando dado ausente; fator sem informação suficiente é marcado `PENDENTE`.
- Cada recálculo cria uma nova versão; a versão anterior é preservada com registro do que mudou e por quê.
- Estudo climático consulta uma API HTTP configurável por ambiente (endereço e token vêm de variável de ambiente, não há fornecedor fixo no código).
- Estudo de rotas/logística usa Azure Maps (geocodificação e roteirização); o projeto migrou de Google Maps/Google Routes para Azure Maps durante o desenvolvimento — o relatório `GSIPRO-HML-701` ainda cita a integração antiga como pendência e deve ser atualizado nesse ponto.
- Avaliação financeira cobre capacidade financeira própria e histórico/risco de pagamento do cliente.
- Central de notificações usa um padrão de fila (outbox) despachada via Microsoft Graph, com verificação por token e execução programada a cada 5 minutos.

## BL-706 — decisão humana

- Toda análise termina em recomendação assistiva; avançar com a oportunidade (`PROCEED` / `PROCEED_WITH_RESTRICTIONS` / `DO_NOT_PROCEED`) exige decisão humana explícita com justificativa de 20 a 2000 caracteres, registrada com autor e correlação — nunca executada automaticamente pelo sistema.

## BL-707 — portão de homologação

- `homologation-gate` avalia oito áreas fixas (segurança, funcional, desempenho, resiliência, custo, acessibilidade, integrações externas, cenários reais autorizados) mais a aprovação do proprietário, retornando `APROVADO`, `REJEITADO`, `BLOQUEADO` ou `AGUARDANDO_APROVACAO_DO_PROPRIETARIO`.
- O relatório oficial `GSIPRO-HML-701` (24/07/2026) registra o veredito **BLOQUEADO PARA PRODUÇÃO** para este incremento especificamente: as áreas de desempenho e integrações externas estão bloqueadas, várias outras parciais, e a aprovação do proprietário está pendente. Este documento de rastreabilidade não altera nem antecipa esse veredito — apenas confirma, pelo código, que o mecanismo de portão existe e funciona como descrito.

## Encerramento técnico do I7

- Testes automatizados: 20 arquivos no módulo de inteligência de oportunidades (a maior cobertura de teste do projeto por módulo) e 1 arquivo no módulo de vínculo proposta-edital (cobertura mais fina que a média do projeto, sem camada de domínio própria).
- Nenhuma chave de API, segredo ou credencial real encontrada no código-fonte; endereço e token da API climática e credenciais do Azure Maps vêm exclusivamente de variável de ambiente.
- **Construção estrutural concluída.** Homologação formal permanece **bloqueada**, conforme `GSIPRO-HML-701` — este incremento não deve ser tratado como autorizado para produção até que as pendências de desempenho e integrações externas sejam resolvidas e o proprietário registre aprovação formal.
