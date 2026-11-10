import "dotenv/config";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { handleAdminApi } from "../src/admin/http.js";

await import("./build-site.js");
const root = path.resolve("dist");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
createServer(async (req, res) => {
  if (await handleAdminApi(req, res)) return;
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    let file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(root)) throw new Error("Caminho inválido");
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    res.setHeader(
      "content-type",
      types[path.extname(file)] || "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.statusCode = 404;
    res.end("Não encontrado");
  }
}).listen(4173, () =>
  console.log(
    "Catálogo: http://localhost:4173 | Painel: http://localhost:4173/admin/",
  ),
);
