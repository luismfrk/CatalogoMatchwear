import "dotenv/config";
import { cp, mkdir, writeFile, copyFile } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await cp("site", "dist", { recursive: true });
await copyFile(
  "node_modules/three/build/three.module.js",
  "dist/assets/three.module.js",
);
await copyFile(
  "node_modules/three/build/three.core.js",
  "dist/assets/three.core.js",
);
await writeFile(
  "dist/config.js",
  `window.MATCHWEAR_CONFIG=${JSON.stringify({ catalogUrl: process.env.CATALOG_URL || "/api/catalog", adminApiUrl: process.env.ADMIN_API_URL || "" })};\n`,
);
try {
  await copyFile("data/catalog.json", "dist/catalog.json");
} catch {}
console.log("Site gerado em dist/.");
