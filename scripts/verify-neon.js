import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { closeDatabasePool, getDatabasePool } from "../src/lib/database.js";
import { readJson, writeJson } from "../src/lib/storage.js";

const name = `healthcheck-${randomUUID()}.json`;
const value = { ok: true, checkedAt: new Date().toISOString() };

try {
  await writeJson(name, value);
  assert.deepEqual(await readJson(name), value);
  await getDatabasePool().query(
    "DELETE FROM catalog_documents WHERE name = $1",
    [name],
  );
  console.log("Neon verificado: escrita, leitura e limpeza concluídas.");
} finally {
  await closeDatabasePool();
}
