export function mergeState(
  previous,
  collected,
  now = new Date().toISOString(),
) {
  const state = previous || { schemaVersion: 1, products: [], sync: {} };
  const byId = new Map(state.products.map((p) => [p.supplierId, p]));
  for (const fresh of collected) {
    const old = byId.get(fresh.supplierId);
    if (old)
      Object.assign(old, fresh, {
        salePrice: old.salePrice ?? null,
        visibility: old.visibility || "draft",
        customImages: old.customImages || [],
        manual: old.manual || {},
      });
    else {
      const item = {
        ...fresh,
        salePrice: null,
        visibility: "draft",
        customImages: [],
        manual: {},
      };
      state.products.push(item);
      byId.set(item.supplierId, item);
    }
  }
  state.sync.lastSuccessfulAt = now;
  state.sync.lastError = null;
  state.sync.productCount = collected.length;
  return state;
}

export function makePublicCatalog(state, settings = {}) {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    lastSuccessfulSyncAt: state.sync?.lastSuccessfulAt || null,
    whatsappNumber: settings.whatsappNumber || "",
    siteUrl: settings.siteUrl || "",
    products: state.products
      .filter((p) => p.visibility === "published" && Number(p.salePrice) > 0)
      .map((p) => ({
        id: p.supplierId,
        slug: `produto-${p.supplierId}`,
        name: p.manual?.name || p.name,
        images: p.customImages?.length ? p.customImages : p.images,
        price: Number(p.salePrice),
        sizes: p.sizes.map(({ name, status }) => ({ name, status })),
        category: normalizeCategory(p.manual?.category || p.category),
      })),
  };
}

function normalizeCategory(category = "") {
  if (/sul.?americano/i.test(category)) return "Sul-Americanos";
  if (/brasileiro/i.test(category)) return "Brasileiros";
  if (/europeu/i.test(category)) return "Europeus";
  if (/seleç|selec/i.test(category)) return "Seleções";
  if (/feminin/i.test(category)) return "Feminina";
  if (/infantil|kit|conjunto/i.test(category)) return "Infantil";
  return category || "Outros";
}

export function validateCollection(result, previous) {
  if (!result.discovered || !result.products.length)
    return { ok: false, reason: "coleta vazia" };
  if (result.errors.length / result.discovered > 0.1)
    return {
      ok: false,
      reason: `${result.errors.length}/${result.discovered} produtos falharam`,
    };
  const prior = previous?.sync?.productCount || 0;
  if (prior >= 10 && result.products.length < prior * 0.7)
    return {
      ok: false,
      reason: `coleta caiu de ${prior} para ${result.products.length} produtos`,
    };
  if (result.products.some((p) => !p.supplierId || !p.name || !p.sizes.length))
    return { ok: false, reason: "campos essenciais ausentes" };
  return { ok: true };
}
