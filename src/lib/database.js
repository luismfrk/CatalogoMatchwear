import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

let pool;

export function normalizeDatabaseUrl(value) {
  const url = new URL(value);
  if (
    ["prefer", "require", "verify-ca"].includes(url.searchParams.get("sslmode"))
  ) {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}

export function getDatabasePool() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL não configurada para o armazenamento Postgres.",
    );
  }

  pool ||= new Pool({
    connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL),
    max: Number(process.env.DATABASE_POOL_MAX || 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  return pool;
}

export async function closeDatabasePool() {
  if (!pool) return;
  await pool.end();
  pool = undefined;
}
