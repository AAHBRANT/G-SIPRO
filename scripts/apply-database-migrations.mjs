import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error("DATABASE_URL é obrigatória para aplicar migrações.");
const migrationsRoot = join(process.cwd(), "prisma", "migrations");
const client = new pg.Client({ connectionString });
const lockId = 728_019_202;

await client.connect();
try {
  await client.query("SELECT pg_advisory_lock($1)", [lockId]);
  const failed = await client.query('SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NULL AND "rolled_back_at" IS NULL LIMIT 1');
  if (failed.rowCount) throw new Error(`Existe uma migração incompleta: ${failed.rows[0].migration_name}.`);
  const applied = new Set((await client.query('SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL')).rows.map(row => row.migration_name));
  const directories = (await readdir(migrationsRoot, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  for (const migrationName of directories) {
    if (applied.has(migrationName)) continue;
    const sql = await readFile(join(migrationsRoot, migrationName, "migration.sql"), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const id = randomUUID();
    const startedAt = new Date();
    console.log(`Aplicando migração ${migrationName}...`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query('INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ($1,$2,now(),$3,NULL,NULL,$4,1)', [id, checksum, migrationName, startedAt]);
      await client.query("COMMIT");
      console.log(`Migração ${migrationName} aplicada.`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.query("SELECT pg_advisory_unlock($1)", [lockId]).catch(() => undefined);
  await client.end();
}
