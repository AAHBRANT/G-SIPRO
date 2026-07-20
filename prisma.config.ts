import { defineConfig } from "prisma/config";

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Ambientes implantados recebem DATABASE_URL diretamente pelo gerenciador de segredos.
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL é obrigatória para operações Prisma.");

const isLocalDatabase = /@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/.test(databaseUrl);
const azurePostgresHost = process.env.GSIPRO_AZURE_POSTGRES_HOST;
const isAuthorizedAzureDatabase =
  process.env.GSIPRO_ALLOW_AZURE_MIGRATIONS === "true" &&
  Boolean(azurePostgresHost) &&
  new URL(databaseUrl).hostname === azurePostgresHost &&
  new URL(databaseUrl).pathname === "/gsipro";

if (!isLocalDatabase && !isAuthorizedAzureDatabase) {
  throw new Error(
    "Banco recusado: use o PostgreSQL local G-SIPRO em 5433 ou autorize explicitamente o host Azure configurado.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
