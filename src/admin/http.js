import "dotenv/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readJson, writeJson } from "../lib/storage.js";
import { makePublicCatalog } from "../sync/catalog.js";

const secret =
  process.env.ADMIN_TOKEN_SECRET || process.env.ADMIN_PASSWORD || "change-me";
const allowedOrigin =
  process.env.ADMIN_ALLOWED_ORIGIN || process.env.SITE_URL || "";

function send(res, status, value) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(value));
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error("Corpo muito grande");
  }
  return raw ? JSON.parse(raw) : {};
}

function safeEqual(a, b) {
  const first = Buffer.from(String(a));
  const second = Buffer.from(String(b));
  return first.length === second.length && timingSafeEqual(first, second);
}

function issueToken() {
  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000 }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

function authorized(req) {
  const token = String(req.headers.authorization || "").replace(
    /^Bearer\s+/i,
    "",
  );
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  if (!safeEqual(signature, expected)) return false;
  try {
    return (
      JSON.parse(Buffer.from(payload, "base64url").toString()).exp > Date.now()
    );
  } catch {
    return false;
  }
}

function setCors(req, res) {
  const origin = req.headers.origin || "";
  if (
    origin &&
    (origin === allowedOrigin ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
  ) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "origin");
    res.setHeader(
      "access-control-allow-headers",
      "authorization, content-type",
    );
    res.setHeader("access-control-allow-methods", "GET, PATCH, POST, OPTIONS");
  }
}

export async function handleAdminApi(req, res) {
  const url = new URL(req.url, "http://localhost");
  if (!url.pathname.startsWith("/api/admin/")) return false;
  setCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }

  try {
    if (url.pathname === "/api/admin/login" && req.method === "POST") {
      const input = await readBody(req);
      if (
        !process.env.ADMIN_PASSWORD ||
        !safeEqual(input.password, process.env.ADMIN_PASSWORD)
      ) {
        send(res, 401, { error: "Senha inválida." });
        return true;
      }
      send(res, 200, { token: issueToken() });
      return true;
    }
    if (!authorized(req)) {
      send(res, 401, { error: "Sessão inválida ou expirada." });
      return true;
    }
    const state = await readJson("state.json");
    if (!state) {
      send(res, 503, { error: "Catálogo ainda não sincronizado." });
      return true;
    }

    if (url.pathname === "/api/admin/products" && req.method === "GET") {
      const visibility = url.searchParams.get("visibility");
      const products = state.products.filter(
        (item) =>
          !visibility || visibility === "all" || item.visibility === visibility,
      );
      send(res, 200, { products, sync: state.sync });
      return true;
    }

    const match = url.pathname.match(/^\/api\/admin\/products\/(\d+)$/);
    if (match && req.method === "PATCH") {
      const product = state.products.find(
        (item) => item.supplierId === match[1],
      );
      if (!product) {
        send(res, 404, { error: "Produto não encontrado." });
        return true;
      }
      const input = await readBody(req);
      if ("salePrice" in input) {
        const price =
          input.salePrice === null || input.salePrice === ""
            ? null
            : Number(input.salePrice);
        if (price !== null && (!(price > 0) || price > 100000)) {
          send(res, 400, { error: "Preço inválido." });
          return true;
        }
        product.salePrice = price;
      }
      if ("visibility" in input) {
        if (!["draft", "published"].includes(input.visibility)) {
          send(res, 400, { error: "Visibilidade inválida." });
          return true;
        }
        if (
          input.visibility === "published" &&
          !(Number(product.salePrice) > 0)
        ) {
          send(res, 400, { error: "Defina um preço antes de publicar." });
          return true;
        }
        product.visibility = input.visibility;
      }
      if ("customImages" in input) {
        if (
          !Array.isArray(input.customImages) ||
          input.customImages.some((image) => !/^https:\/\//.test(image))
        ) {
          send(res, 400, { error: "Use URLs HTTPS válidas para as imagens." });
          return true;
        }
        product.customImages = input.customImages.slice(0, 12);
      }
      await writeJson("state.json", state);
      await writeJson(
        "catalog.json",
        makePublicCatalog(state, {
          whatsappNumber: process.env.WHATSAPP_NUMBER,
          siteUrl: process.env.SITE_URL,
        }),
        { publicRead: true },
      );
      send(res, 200, { product });
      return true;
    }
    send(res, 404, { error: "Rota não encontrada." });
    return true;
  } catch (error) {
    console.error(error);
    send(res, 500, { error: "Erro interno no painel." });
    return true;
  }
}
