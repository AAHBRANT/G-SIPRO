# Aviso no Telegram ao Final da Triagem — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sempre que a `SupportTriageService` terminar de triar um chamado, enviar uma mensagem para um chat do Telegram avisando o resultado.

**Architecture:** Um módulo novo (`telegram-notifier.ts`) chama a API do Telegram (`sendMessage`) direto, sem passar por n8n/Central IA. `SupportTriageService` recebe esse notificador por injeção de construtor (mesmo padrão já usado para o `provider` de IA) e o chama depois que a transação de triagem confirma. Falha no Telegram nunca propaga — é capturada e logada dentro do próprio notificador.

**Tech Stack:** TypeScript, Next.js (App Router), Prisma, Vitest. Sem dependências novas — usa `fetch` global.

## Global Constraints

- Nunca ler, imprimir ou commitar `.env*`, segredos ou tokens (regra do `AGENTS.md` do G-SIPRO).
- `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` são opcionais em `env.ts` — ausência não pode quebrar o boot do app nem a triagem (mesmo padrão de `OPENAI_API_KEY`/`CENTRAL_IA_BASE_URL`).
- Uma falha ao notificar o Telegram nunca pode impedir `triageTicket()` de retornar o resultado da triagem.
- Seguir os padrões já estabelecidos no módulo `support` e em outros providers HTTP do projeto (injeção de `fetcher` para teste, sem mockar `global.fetch`).
- Rodar `pnpm check` (lint + typecheck + test) antes de cada commit.

---

### Task 1: Configuração e módulo `telegram-notifier.ts`

**Files:**
- Modify: `src/core/config/env.ts` (adicionar `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID`)
- Create: `src/modules/support/infrastructure/telegram-notifier.ts`
- Test: `src/modules/support/infrastructure/telegram-notifier.test.ts`

**Interfaces:**
- Consumes: `SupportDiagnosis` de `@/modules/support/domain/support-ticket` (campo usado: `severity`, um de `"LOW" | "MEDIUM" | "HIGH" | "CRITICAL"`).
- Produces (para a Task 2):
  - `export type SupportTicketNotifier = { notifyTicketTriaged(ticket: { number: number; title: string }, diagnosis: SupportDiagnosis, status: string, approvalRequired: boolean): Promise<void> }`
  - `export class TelegramNotifier implements SupportTicketNotifier` — construtor `(botToken = process.env.TELEGRAM_BOT_TOKEN?.trim(), chatId = process.env.TELEGRAM_CHAT_ID?.trim(), fetcher: typeof fetch = fetch)`.
  - `export function formatTicketTriagedMessage(ticket, diagnosis, status, approvalRequired): string`.

- [ ] **Step 1: Adicionar as duas variáveis em `env.ts`**

Em `src/core/config/env.ts`, na linha 27 (logo depois de `CENTRAL_IA_API_TOKEN` e antes de `SUPPORT_EXECUTOR_TOKEN`), adicionar:

```ts
  // Bot dedicado do Telegram para avisos de chamados triados (não é o bot CAFI
  // do n8n — ver docs/superpowers/specs/2026-08-11-telegram-ticket-notification-design.md).
  TELEGRAM_BOT_TOKEN: z.string().trim().min(20).optional().or(z.literal("")),
  TELEGRAM_CHAT_ID: z.string().trim().min(1).optional().or(z.literal("")),
```

- [ ] **Step 2: Escrever os testes de `formatTicketTriagedMessage` (falhando)**

Criar `src/modules/support/infrastructure/telegram-notifier.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import type { SupportDiagnosis } from "../domain/support-ticket";
import { formatTicketTriagedMessage, TelegramNotifier } from "./telegram-notifier";

const diagnosis: SupportDiagnosis = {
  summary: "Resumo do diagnóstico",
  probableCause: "Causa provável",
  severity: "HIGH",
  changeClass: "CORRECTION",
  requiredActor: "AI",
  ownerActionCategory: null,
  requiredAction: null,
  securityGuidance: null,
  recommendedAction: "Ação recomendada",
  suggestedTests: ["Reproduzir o cenário"],
  userGuidance: "Acompanhe este chamado.",
  confidence: 0.8,
};

const ticket = { number: 42, title: "Erro ao salvar proposta" };

describe("formatTicketTriagedMessage", () => {
  it("inclui número, título, status e severidade", () => {
    const texto = formatTicketTriagedMessage(ticket, diagnosis, "TRIAGED", false);
    expect(texto).toContain("#42");
    expect(texto).toContain("Erro ao salvar proposta");
    expect(texto).toContain("TRIAGED");
    expect(texto).toContain("Alta");
  });

  it("avisa quando precisa de aprovação do proprietário", () => {
    const texto = formatTicketTriagedMessage(ticket, diagnosis, "WAITING_APPROVAL", true);
    expect(texto).toContain("aprovação do proprietário");
  });

  it("não menciona aprovação quando ela não é exigida", () => {
    const texto = formatTicketTriagedMessage(ticket, diagnosis, "TRIAGED", false);
    expect(texto).not.toContain("aprovação do proprietário");
  });
});

describe("TelegramNotifier", () => {
  it("não chama a API quando o token não está configurado", async () => {
    const fetcher = vi.fn();
    await new TelegramNotifier("", "123", fetcher).notifyTicketTriaged(ticket, diagnosis, "TRIAGED", false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("não chama a API quando o chat_id não está configurado", async () => {
    const fetcher = vi.fn();
    await new TelegramNotifier("token-valido-de-teste", "", fetcher).notifyTicketTriaged(ticket, diagnosis, "TRIAGED", false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("envia a mensagem para a API do Telegram quando configurado", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await new TelegramNotifier("token-valido-de-teste", "123456", fetcher).notifyTicketTriaged(ticket, diagnosis, "TRIAGED", false);

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bottoken-valido-de-teste/sendMessage");
    const body = JSON.parse(init.body as string);
    expect(body.chat_id).toBe("123456");
    expect(body.text).toContain("#42");
  });

  it("não lança quando a API responde com erro HTTP", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("erro", { status: 401 }));
    await expect(new TelegramNotifier("t", "1", fetcher).notifyTicketTriaged(ticket, diagnosis, "TRIAGED", false)).resolves.toBeUndefined();
  });

  it("não lança quando a chamada de rede falha", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(new TelegramNotifier("t", "1", fetcher).notifyTicketTriaged(ticket, diagnosis, "TRIAGED", false)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: Rodar os testes para confirmar que falham (módulo ainda não existe)**

Run: `pnpm vitest run src/modules/support/infrastructure/telegram-notifier.test.ts`
Expected: FAIL — `Cannot find module './telegram-notifier'`

- [ ] **Step 4: Implementar `telegram-notifier.ts`**

Criar `src/modules/support/infrastructure/telegram-notifier.ts`:

```ts
import { getEnvironment } from "@/core/config/env";
import { createLogger } from "@/core/observability/logger";
import type { SupportDiagnosis } from "@/modules/support/domain/support-ticket";

const TELEGRAM_API_BASE = "https://api.telegram.org";

function notifierLogger() {
  return createLogger(getEnvironment());
}

const severityLabel: Record<SupportDiagnosis["severity"], string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export type SupportTicketNotifier = {
  notifyTicketTriaged(
    ticket: { number: number; title: string },
    diagnosis: SupportDiagnosis,
    status: string,
    approvalRequired: boolean,
  ): Promise<void>;
};

/** Função pura — sem rede, fácil de testar isolada. */
export function formatTicketTriagedMessage(
  ticket: { number: number; title: string },
  diagnosis: SupportDiagnosis,
  status: string,
  approvalRequired: boolean,
): string {
  const linhas = [
    `Chamado #${ticket.number} triado`,
    ticket.title,
    `Status: ${status}`,
    `Severidade: ${severityLabel[diagnosis.severity]}`,
  ];
  if (approvalRequired) linhas.push("Precisa de aprovação do proprietário.");
  linhas.push("Veja em: /support");
  return linhas.join("\n");
}

/**
 * Chama a API do Telegram direto — sem passar por n8n/Central IA, para não
 * depender de três serviços locais só para um aviso chegar (ver
 * docs/superpowers/specs/2026-08-11-telegram-ticket-notification-design.md).
 *
 * Nunca lança: uma falha aqui não pode impedir a triagem de ser concluída.
 */
export class TelegramNotifier implements SupportTicketNotifier {
  constructor(
    private readonly botToken = process.env.TELEGRAM_BOT_TOKEN?.trim(),
    private readonly chatId = process.env.TELEGRAM_CHAT_ID?.trim(),
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async notifyTicketTriaged(
    ticket: { number: number; title: string },
    diagnosis: SupportDiagnosis,
    status: string,
    approvalRequired: boolean,
  ): Promise<void> {
    if (!this.botToken || !this.chatId) return;
    try {
      const text = formatTicketTriagedMessage(ticket, diagnosis, status, approvalRequired);
      const response = await this.fetcher(`${TELEGRAM_API_BASE}/bot${this.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: this.chatId, text }),
      });
      if (!response.ok) throw new Error(`TELEGRAM_HTTP_${response.status}`);
    } catch (error) {
      notifierLogger().warn({
        ticketNumber: ticket.number,
        errorName: error instanceof Error ? error.name : "UNKNOWN",
        errorMessage: error instanceof Error ? error.message : String(error),
      }, "Não foi possível enviar o aviso de triagem no Telegram.");
    }
  }
}
```

- [ ] **Step 5: Rodar os testes de novo e confirmar que passam**

Run: `pnpm vitest run src/modules/support/infrastructure/telegram-notifier.test.ts`
Expected: PASS (8 testes)

- [ ] **Step 6: Rodar typecheck e lint**

Run: `pnpm typecheck && pnpm lint`
Expected: sem erros

- [ ] **Step 7: Commit**

```bash
git add src/core/config/env.ts src/modules/support/infrastructure/telegram-notifier.ts src/modules/support/infrastructure/telegram-notifier.test.ts
git commit -m "feat(support): módulo de aviso no Telegram para chamados triados"
```

---

### Task 2: Ligar o notificador em `SupportTriageService`

**Files:**
- Modify: `src/modules/support/application/support-triage-service.ts`
- Create: `scripts/smoke-support-triage-notification.ts`

**Interfaces:**
- Consumes: `SupportTicketNotifier` e `TelegramNotifier` de `@/modules/support/infrastructure/telegram-notifier` (Task 1).
- Produces: `SupportTriageService` passa a aceitar um segundo parâmetro de construtor `notifier: SupportTicketNotifier = new TelegramNotifier()`.

- [ ] **Step 1: Escrever o smoke test (falhando)**

Criar `scripts/smoke-support-triage-notification.ts`, seguindo o mesmo padrão de `scripts/smoke-document.ts` (guarda de `DATABASE_URL`, usa `getDatabase()` direto, roda contra o Postgres local do G-SIPRO):

```ts
import { randomUUID } from "node:crypto";

import { getDatabase } from "../src/core/database/prisma";
import { SupportTriageService } from "../src/modules/support/application/support-triage-service";
import { CentralIaSupportProvider } from "../src/modules/support/infrastructure/central-ia-support-provider";
import type { SupportDiagnosis } from "../src/modules/support/domain/support-ticket";
import type { SupportTicketNotifier } from "../src/modules/support/infrastructure/telegram-notifier";

async function main() {
  if (!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/)) throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  const database = getDatabase();
  const user = await database.user.findFirstOrThrow({ where: { status: "ACTIVE" } });
  const ticket = await database.supportTicket.create({
    data: {
      type: "BUG",
      title: "Chamado sintético — smoke de notificação no Telegram",
      description: "Criado pelo smoke test; não representa um problema real.",
      reporterId: user.id,
    },
  });

  const chamadas: { ticketNumber: number; status: string; approvalRequired: boolean; severity: SupportDiagnosis["severity"] }[] = [];
  const notifierFalso: SupportTicketNotifier = {
    async notifyTicketTriaged(ticketArg, diagnosis, status, approvalRequired) {
      chamadas.push({ ticketNumber: ticketArg.number, status, approvalRequired, severity: diagnosis.severity });
    },
  };

  // baseUrl="" força CENTRAL_IA_NOT_CONFIGURED, cai no fallbackDiagnosis — determinístico e rápido.
  const service = new SupportTriageService(new CentralIaSupportProvider(""), notifierFalso);
  const outcome = await service.triageTicket(ticket.id, randomUUID());
  if (!outcome) throw new Error("A triagem não aplicou (o chamado já estava triado?).");
  if (chamadas.length !== 1) throw new Error(`O notificador deveria ter sido chamado 1 vez; foi chamado ${chamadas.length}.`);

  console.log(JSON.stringify({ outcomeStatus: outcome.status, notifierCalls: chamadas.length, notifierPayload: chamadas[0] }));
  await database.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Smoke falhou");
  process.exitCode = 1;
});
```

- [ ] **Step 2: Rodar o smoke test e confirmar que falha**

Requer Postgres local do G-SIPRO no ar (`localhost:5433/gsipro`) e seed aplicado (ver `AGENTS.md`/`PROJECT_STATUS.md` do G-SIPRO para subir se necessário).

Run: `npx tsx scripts/smoke-support-triage-notification.ts`
Expected: FAIL — `SupportTriageService` ainda não aceita um segundo argumento de construtor (o notificador falso nunca é chamado; `chamadas.length` é `0`), ou erro de tipo no `tsx` se o parâmetro nem existir.

- [ ] **Step 3: Adicionar a injeção do notificador em `SupportTriageService`**

Em `src/modules/support/application/support-triage-service.ts`:

Adicionar o import (perto dos demais imports do topo do arquivo):

```ts
import { TelegramNotifier, type SupportTicketNotifier } from "@/modules/support/infrastructure/telegram-notifier";
```

Alterar o construtor (linha 66):

```ts
  constructor(
    private readonly provider = new CentralIaSupportProvider(),
    private readonly notifier: SupportTicketNotifier = new TelegramNotifier(),
  ) {}
```

Alterar o final de `triageTicket()` (linhas 152–153), inserindo a chamada ao notificador entre a confirmação da transação e o `return`:

```ts
    if (!applied) return undefined;
    await this.notifier.notifyTicketTriaged(ticket, diagnosis, status, approvalRequired);
    return { ticketId, status, approvalRequired, model };
```

- [ ] **Step 4: Rodar o smoke test de novo e confirmar que passa**

Run: `npx tsx scripts/smoke-support-triage-notification.ts`
Expected: PASS — imprime um JSON com `"notifierCalls":1` e `"outcomeStatus"` igual ao status calculado pela política de aprovação.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `pnpm check`
Expected: lint, typecheck e todos os testes (incluindo os da Task 1) passam.

- [ ] **Step 6: Commit**

```bash
git add src/modules/support/application/support-triage-service.ts scripts/smoke-support-triage-notification.ts
git commit -m "feat(support): notificar Telegram ao final da triagem de chamados"
```

---

## Depois da implementação (fora do código, manual)

1. Confirmar que `TELEGRAM_BOT_TOKEN` já está no Key Vault `kv-gsipro-hml-27207f` como secret `telegram-bot-token` (feito em 2026-08-11 pelo proprietário).
2. Adicionar a referência do secret e a variável simples no Container App de homologação:
   ```bash
   az containerapp secret set --name ca-gsipro-hml-aahbrant --resource-group rg-gsipro-hml-brazilsouth --secrets telegram-bot-token=keyvaultref:https://kv-gsipro-hml-27207f.vault.azure.net/secrets/telegram-bot-token,identityref:system
   az containerapp update --name ca-gsipro-hml-aahbrant --resource-group rg-gsipro-hml-brazilsouth --set-env-vars "TELEGRAM_BOT_TOKEN=secretref:telegram-bot-token" "TELEGRAM_CHAT_ID=8226485025"
   ```
   (Confirmar antes se o Container App usa managed identity para ler o Key Vault — os outros secrets do `az containerapp show` anteriores tinham `keyVaultUrl` preenchido, então o padrão já existe; conferir a sintaxe exata de identidade com `az containerapp show --query properties.configuration.secrets`.)
3. Testar de ponta a ponta: abrir um chamado de teste em homologação e confirmar que a mensagem chega no Telegram.
