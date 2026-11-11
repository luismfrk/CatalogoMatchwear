import "dotenv/config";
import { collectAll } from "./supplier.js";
import {
  mergeState,
  makePublicCatalog,
  validateCollection,
} from "./catalog.js";
import { readJson, writeJson } from "../lib/storage.js";
import { closeDatabasePool } from "../lib/database.js";

export async function runSync() {
  const startedAt = new Date().toISOString();
  const previous = await readJson("state.json", null);
  const previousPublic = await readJson("catalog.json", null);
  try {
    const result = await collectAll({
      knownUrls: previous?.products?.map((product) => product.sourceUrl) || [],
      onProgress: (n, t) => process.stdout.write(`\rColetando ${n}/${t}`),
    });
    process.stdout.write("\n");
    const validation = validateCollection(result, previous);
    if (!validation.ok)
      throw new Error(`Coleta rejeitada: ${validation.reason}`);
    const state = mergeState(previous, result.products);
    await writeJson("state.json", state);
    await writeJson(
      "catalog.json",
      makePublicCatalog(state, {
        whatsappNumber:
          process.env.WHATSAPP_NUMBER || previousPublic?.whatsappNumber,
        siteUrl: process.env.SITE_URL || previousPublic?.siteUrl,
      }),
      { publicRead: true },
    );
    const report = {
      startedAt,
      finishedAt: new Date().toISOString(),
      ok: true,
      discovered: result.discovered,
      imported: result.products.length,
      errors: result.errors,
    };
    await writeJson("sync-report.json", report);
    console.log(
      `Sincronização concluída: ${result.products.length} produtos; ${result.errors.length} falhas.`,
    );
    return report;
  } catch (error) {
    const report = {
      startedAt,
      finishedAt: new Date().toISOString(),
      ok: false,
      error: error.message,
    };
    if (previous) {
      previous.sync ||= {};
      previous.sync.lastError = report;
      await writeJson("state.json", previous);
    }
    await writeJson("sync-report.json", report);
    console.error(error.stack || error);
    process.exitCode = 1;
    return report;
  }
}
if (process.argv[1]?.endsWith("run.js")) {
  await runSync();
  await closeDatabasePool();
}
