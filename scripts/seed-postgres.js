import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { closeDatabasePool } from "../src/lib/database.js";
import { readJson, writeJson } from "../src/lib/storage.js";

const documents = ["state.json", "catalog.json", "sync-report.json"];

try {
  for (const name of documents) {
    if ((await readJson(name, null)) !== null) {
      console.log(`Mantido no Neon: ${name}`);
      continue;
    }

    try {
      const value = JSON.parse(
        await readFile(path.resolve("data", name), "utf8"),
      );
      await writeJson(name, value);
      console.log(`Importado para o Neon: ${name}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      console.log(`Arquivo local ausente, ignorado: ${name}`);
    }
  }
} finally {
  await closeDatabasePool();
}
