# G-SIPRO — Incremento I0

Fundação técnica do Sistema Inteligente de Gestão de Propostas, derivada das baselines aprovadas `GSIPRO-TEC-201`, `GSIPRO-TEC-202`, `GSIPRO-EXE-301`, `GSIPRO-PLN-302` e `GSIPRO-TST-401`.

## Stack fixada

- Node.js 24+
- Next.js 16 / React 19 / TypeScript 5
- PostgreSQL / Prisma ORM 7
- Zod 4
- Pino
- Vitest 4
- Tailwind CSS 4

## Comandos

```powershell
Copy-Item .env.example .env
pnpm install
pnpm db:validate
pnpm db:generate
pnpm check
pnpm build
pnpm dev
```

## OpenAI — BL-502

Configure a credencial somente no arquivo local `.env.local` do servidor:

```dotenv
OPENAI_API_KEY=chave_criada_no_painel_da_openai
OPENAI_REQUEST_TIMEOUT_MS=120000
```

Não registre a chave em Git, documentos, logs ou telas. O modelo utilizado é o `providerModelVersion` do inventário aprovado em `/ai-governance`; a execução documental ocorre em `/ai-extractions` e usa `store: false`.

## Regras do I0

- Autorização nega por padrão.
- Segredos e dados reais não pertencem ao repositório.
- Logs são estruturados, correlacionados e têm campos sensíveis redigidos.
- Eventos de auditoria são append-only na camada de aplicação.
- Migrations e mudanças de esquema são versionadas.
- Todo item implementado deve manter vínculo com o backlog aprovado.

## Estado

O I0 implementa fundações. Funcionalidades de negócio começam no I1 após os portões de qualidade aplicáveis.
