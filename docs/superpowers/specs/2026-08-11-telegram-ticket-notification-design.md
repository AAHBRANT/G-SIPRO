# Aviso no Telegram ao final da triagem de chamados

Data: 2026-08-11

## Objetivo

Sempre que a Central IA terminar de triar um chamado de suporte do G-SIPRO (`SupportTicket`),
enviar uma mensagem no Telegram avisando o resultado, assinada pelo nome da IA: **GUULY** (nome
adotado em 2026-08-11 para todo texto do G-SIPRO visível ao usuário que se refere à IA — ver
commit `3edccaa`). Sem filtro por severidade ou status — todo chamado triado gera um aviso.

## Destinatário

Chat direto do proprietário com um bot dedicado do Telegram, `@AAHBRANT_bot`, criado
especificamente para isto. Não reaproveita o bot CAFI (`g_cafi_bot`) usado pelo n8n, para manter
os avisos de chamado separados do restante do tráfego daquele bot.

## Arquitetura

O G-SIPRO chama a API do Telegram diretamente (`POST https://api.telegram.org/bot<token>/sendMessage`).
Não passa pelo n8n nem pela Central IA — um salto só, sem depender de três serviços locais
estarem de pé para um aviso chegar.

Alternativa considerada e descartada: relay via n8n (G-SIPRO → túnel ngrok → Central IA
`/n8n-proxy` → workflow do n8n → Telegram). Descartada por criar dependência de três serviços
externos ao G-SIPRO só para esta notificação, quando a chamada direta resolve com um único ponto
de falha.

## Configuração nova

- `TELEGRAM_BOT_TOKEN` — secret no Key Vault (`kv-gsipro-hml-27207f`, nome do segredo
  `telegram-bot-token`), referenciado no Container App como secret, mesmo padrão de
  `openai-api-key` e `database-url`. Validado em `env.ts` como opcional (string, mínimo 20
  caracteres) — mesmo padrão de `OPENAI_API_KEY`.
- `TELEGRAM_CHAT_ID` — variável simples (não é segredo, é um identificador numérico), validada em
  `env.ts` como string opcional.
- Se qualquer um dos dois estiver vazio, a notificação é pulada e um aviso é registrado no log —
  nunca quebra a triagem. Mesmo padrão de degradação do `CENTRAL_IA_BASE_URL` ausente.

Como obter os valores (procedimento manual, fora do código, feito uma vez pelo proprietário):
1. No Telegram, `@BotFather` → confirmar o token atual do `@AAHBRANT_bot` (gerar um novo se o
   token tiver sido exposto em algum momento antes de ser configurado).
2. Enviar qualquer mensagem ao `@AAHBRANT_bot` pelo Telegram (bot não inicia conversa).
3. Consultar `GET https://api.telegram.org/bot<token>/getUpdates` para obter o `chat_id` da
   conversa.
4. Gravar os dois valores no Key Vault / Container App (mesmo fluxo já usado para os outros
   secrets do projeto).

## Código novo

Arquivo `src/modules/support/infrastructure/telegram-notifier.ts`, com duas funções:

- `formatTicketTriagedMessage(ticket: { number: number; title: string }, diagnosis: SupportDiagnosis, status: string, approvalRequired: boolean): string`
  — função pura, monta o texto: número do chamado, título, status resultante, severidade, se
  precisa de aprovação do proprietário, e um link para a tela de Suporte (`${APP_URL}/support` —
  não existe rota de detalhe por ID hoje, os chamados abrem dentro da própria listagem).
- `notifyTicketTriaged(ticket, diagnosis, status, approvalRequired): Promise<void>` — mesmos
  parâmetros de `formatTicketTriagedMessage`. Lê `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` do
  ambiente; se algum estiver vazio, loga aviso e retorna. Caso contrário, monta a mensagem e faz o
  `POST` ao Telegram. Qualquer erro (rede, HTTP não-2xx) é capturado e logado — a função nunca
  lança.

  A assinatura usa `ticket`/`diagnosis`/`status`/`approvalRequired` separados (em vez de receber
  o `TriageOutcome` já montado) porque no ponto de chamada, dentro de `triageTicket()`, essas
  variáveis já existem soltas — o objeto `TriageOutcome` só é construído no `return` seguinte.

## Onde é chamado

Dentro de `SupportTriageService.triageTicket()`
(`src/modules/support/application/support-triage-service.ts`), imediatamente após a transação de
triagem confirmar (`if (!applied) return undefined;`), passando `ticket`, `diagnosis`, `status` e
`approvalRequired` (todos já em escopo ali) — antes do `return { ticketId, status,
approvalRequired, model }`. Roda com `await`, mas dentro do próprio `try/catch` do notifier — uma
falha no Telegram nunca impede o método de retornar o resultado da triagem.

## Testes

- Teste unitário de `formatTicketTriagedMessage`: função pura, cobre os campos obrigatórios e o
  caso `approvalRequired`.
- Teste de `notifyTicketTriaged` com `fetch` mockado (padrão já usado em
  `openai-support-provider.test.ts`): sucesso, falha HTTP, exceção de rede, e as duas variáveis de
  ambiente ausentes (não deve chamar `fetch`).
- Sem teste de integração contra o Telegram real — é uma chamada de rede externa, fora do escopo
  dos testes automatizados do projeto.

## Fora de escopo

- Não notifica em nenhum outro evento do ciclo de vida do chamado (só ao final da triagem
  automática).
- Não envia para grupo/canal — só para o chat direto configurado.
- Não reutiliza nem modifica a integração existente com o n8n/bot CAFI.
