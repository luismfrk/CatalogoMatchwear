import "dotenv/config";
import { applySalesPolicy, makePublicCatalog } from "../src/sync/catalog.js";
import { closeDatabasePool } from "../src/lib/database.js";
import { readJson, writeJson } from "../src/lib/storage.js";

const state = await readJson("state.json", null);
if (!state) throw new Error("Estado do catálogo não encontrado.");

const previousPublic = await readJson("catalog.json", {});
applySalesPolicy(state);

await writeJson("state.json", state);
await writeJson(
  "catalog.json",
  makePublicCatalog(state, {
    whatsappNumber:
      process.env.WHATSAPP_NUMBER || previousPublic.whatsappNumber,
    siteUrl: process.env.SITE_URL || previousPublic.siteUrl,
  }),
  { publicRead: true },
);

const published = state.products.filter(
  (product) => product.visibility === "published",
);
console.log(
  `Regra aplicada: ${published.length} produtos publicados (${published.filter((product) => product.salePrice === 180).length} Torcedor, ${published.filter((product) => product.salePrice === 250).length} Jogador).`,
);

await closeDatabasePool();
