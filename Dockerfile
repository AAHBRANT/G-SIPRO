FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma.config.ts ./
COPY prisma ./prisma
ENV CI=true \
    DATABASE_URL=postgresql://gsipro:build-only@localhost:5433/gsipro
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=postgresql://gsipro:build-only@localhost:5433/gsipro \
    ENTRA_TENANT_ID=00000000-0000-4000-8000-000000000000 \
    ENTRA_CLIENT_ID=00000000-0000-4000-8000-000000000000 \
    ENTRA_CLIENT_SECRET=build-only-not-a-client-secret \
    AUTH_SECRET=build-only-auth-secret-0000000000000000 \
    OPENAI_API_KEY=build-only-openai-key-000000000000 \
    AUTH_URL=http://localhost:3001
RUN pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001 \
    HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && mkdir -p /mnt/gsipro-documents \
    && chown nextjs:nodejs /mnt/gsipro-documents
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma/migrations ./prisma/migrations
COPY --from=builder --chown=nextjs:nodejs /app/scripts/apply-database-migrations.mjs ./scripts/apply-database-migrations.mjs
USER nextjs
EXPOSE 3001
CMD ["sh", "-c", "node scripts/apply-database-migrations.mjs && node server.js"]
