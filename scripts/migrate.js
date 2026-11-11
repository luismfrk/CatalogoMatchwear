import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { normalizeDatabaseUrl } from "../src/lib/database.js";

const { Client } = pg;
const rawConnectionString =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!rawConnectionString) {
  throw new Error(
    "Configure DATABASE_URL_UNPOOLED para executar as migrações.",
  );
}

const client = new Client({
  connectionString: normalizeDatabaseUrl(rawConnectionString),
});
await client.connect();

try {
  await client.query("SELECT pg_advisory_lock(12961237)");
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const directory = path.resolve("migrations");
  const files = (await readdir(directory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const exists = await client.query(
      "SELECT 1 FROM app_migrations WHERE name = $1",
      [file],
    );
    if (exists.rowCount) {
      console.log(`Migração já aplicada: ${file}`);
      continue;
    }

    await client.query("BEGIN");
    try {
      await client.query(await readFile(path.join(directory, file), "utf8"));
      await client.query("INSERT INTO app_migrations (name) VALUES ($1)", [
        file,
      ]);
      await client.query("COMMIT");
      console.log(`Migração aplicada: ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.query("SELECT pg_advisory_unlock(12961237)").catch(() => {});
  await client.end();
}
