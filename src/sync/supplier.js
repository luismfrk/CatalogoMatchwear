import * as cheerio from "cheerio";

const base = (
  process.env.SUPPLIER_BASE_URL || "https://www.mantoesportivo.com"
).replace(/\/$/, "");
const delayMs = Number(process.env.REQUEST_DELAY_MS || 700);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "MatchwearFC-CatalogSync/1.0 (+catalog sync; low frequency)",
        accept: "text/html",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function extractJsonArray(html, marker) {
  const pos = html.indexOf(marker);
  if (pos < 0) throw new Error(`Marcador ${marker} ausente`);
  const start = html.indexOf("[", pos);
  let depth = 0,
    quote = false,
    escape = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (quote) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') quote = false;
      continue;
    }
    if (ch === '"') quote = true;
    else if (ch === "[") depth++;
    else if (ch === "]" && --depth === 0)
      return JSON.parse(html.slice(start, i + 1));
  }
  throw new Error("JSON de variantes incompleto");
}

export function parseProduct(html, url) {
  const $ = cheerio.load(html);
  const variants = extractJsonArray(html, "LS.variants =");
  const idMatch = html.match(/LS\.product\s*=\s*\{[\s\S]*?\bid\s*:\s*(\d+)/);
  const jsonLd = $('script[type="application/ld+json"]')
    .map((_, el) => {
      try {
        return JSON.parse($(el).text());
      } catch {
        return null;
      }
    })
    .get()
    .filter(Boolean);
  const heading = $("h1").first().text().replace(/\s+/g, " ").trim();
  const normalize = (x) =>
    String(x || "")
      .replace(/\\\//g, "/")
      .replace(/\s+/g, " ")
      .trim();
  const productLd = jsonLd.find(
    (x) => x["@type"] === "Product" && normalize(x.name) === normalize(heading),
  );
  const name =
    heading ||
    productLd?.name ||
    $('meta[property="og:title"]').attr("content");
  const galleryImages = $(".js-product-slide img")
    .map((_, el) => $(el).attr("data-zoom") || $(el).attr("src"))
    .get();
  const images = [
    ...new Set(
      [
        ...galleryImages,
        ...$('meta[property="og:image"]')
          .map((_, el) => $(el).attr("content"))
          .get(),
        ...variants.map((v) => v.image_url),
        ...(Array.isArray(productLd?.image)
          ? productLd.image
          : [productLd?.image]),
      ]
        .filter(Boolean)
        .map((x) => {
          const absolute = x.startsWith("//") ? `https:${x}` : x;
          return absolute.replace(/^http:\/\//, "https://");
        }),
    ),
  ];
  const category =
    $(".breadcrumb a, .breadcrumbs a")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((x) => x && !/início|home|produtos/i.test(x))
      .at(-1) || inferCategory(name);
  const sizes = variants.map((v) => ({
    variantId: String(v.id),
    name:
      [v.option0, v.option1, v.option2].filter(Boolean).join(" / ") || "Único",
    status:
      v.available === true && Number(v.stock) > 0
        ? "available"
        : v.available === false || Number(v.stock) === 0
          ? "sold_out"
          : "unknown",
    quantity: Number.isFinite(Number(v.stock)) ? Number(v.stock) : null,
  }));
  if (!idMatch || !name || !variants.length)
    throw new Error(`Produto sem campos essenciais: ${url}`);
  return {
    supplierId: idMatch[1],
    name,
    images,
    category,
    sourceUrl: url,
    sizes,
    supplierUpdatedAt: new Date().toISOString(),
  };
}

function inferCategory(name = "") {
  if (/infantil|kit|conjunto/i.test(name)) return "Infantil";
  if (/feminin/i.test(name)) return "Feminina";
  if (/seleção|brasil/i.test(name)) return "Seleções";
  if (/retrô|retro/i.test(name)) return "Retrô";
  return "Camisas de futebol";
}

export async function discoverProductUrls() {
  const urls = new Set();
  const max = Number(process.env.MAX_PAGES || 100);
  let lastPage = 1;
  for (let page = 1; page <= Math.min(max, lastPage); page++) {
    const url =
      page === 1 ? `${base}/produtos/` : `${base}/produtos/page/${page}/`;
    const html = await get(url);
    const $ = cheerio.load(html);
    const paginationPages = $('a[href*="/produtos/page/"]')
      .map((_, el) => {
        const match = String($(el).attr("href")).match(
          /\/produtos\/page\/(\d+)\//,
        );
        return match ? Number(match[1]) : 0;
      })
      .get();
    lastPage = Math.max(lastPage, ...paginationPages);
    const found = $('a[href*="/produtos/"]')
      .map((_, el) => {
        const parsed = new URL($(el).attr("href"), base);
        return parsed.origin === base &&
          /^\/produtos\/[^/]+\/$/.test(parsed.pathname)
          ? `${parsed.origin}${parsed.pathname}`
          : null;
      })
      .get()
      .filter(Boolean);
    found.forEach((x) => urls.add(x));
    if (page < lastPage) await sleep(delayMs);
  }
  return [...urls];
}

export async function collectAll({ onProgress, knownUrls = [] } = {}) {
  const urls = [
    ...new Set([
      ...(await discoverProductUrls()),
      ...knownUrls.filter(Boolean),
    ]),
  ];
  if (!urls.length) throw new Error("Listagem não retornou produtos");
  const products = [];
  const errors = [];
  for (let i = 0; i < urls.length; i++) {
    try {
      products.push(parseProduct(await get(urls[i]), urls[i]));
    } catch (error) {
      errors.push({ url: urls[i], error: error.message });
    }
    onProgress?.(i + 1, urls.length);
    await sleep(delayMs);
  }
  return { products, errors, discovered: urls.length };
}

export async function collectOne(url) {
  return parseProduct(await get(url), url);
}
