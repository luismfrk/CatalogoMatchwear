import test from "node:test";
import assert from "node:assert/strict";
import {
  applySalesPolicy,
  mergeState,
  makePublicCatalog,
  validateCollection,
} from "../src/sync/catalog.js";

const item = (stock = 2, name = "Camisa X") => ({
  supplierId: "10",
  name,
  images: ["x.jpg"],
  category: "Masculina",
  sourceUrl: "https://supplier/x",
  sizes: [
    {
      variantId: "1",
      name: "M",
      status: stock ? "available" : "sold_out",
      quantity: stock,
    },
  ],
});

test("segunda sincronização não duplica e atualiza apenas a variante", () => {
  let state = mergeState(null, [item(2)], "t1");
  state.products[0].salePrice = 199.9;
  state.products[0].visibility = "published";
  state = mergeState(state, [item(0)], "t2");
  assert.equal(state.products.length, 1);
  assert.equal(state.products[0].sizes[0].status, "sold_out");
  assert.equal(state.products[0].salePrice, 199.9);
  assert.equal(state.products[0].visibility, "draft");
});

test("catálogo público omite origem e só publica item com preço", () => {
  const state = mergeState(null, [item()]);
  state.products[0].salePrice = 149.9;
  state.products[0].visibility = "published";
  const catalog = makePublicCatalog(state);
  assert.equal(catalog.products.length, 1);
  assert.equal(catalog.products[0].sourceUrl, undefined);
  assert.equal(JSON.stringify(catalog).includes("supplier"), false);
});

test("coleta vazia ou muito incompleta é rejeitada", () => {
  assert.equal(
    validateCollection({ discovered: 0, products: [], errors: [] }).ok,
    false,
  );
  assert.equal(
    validateCollection({ discovered: 2, products: [item()], errors: [{}] }).ok,
    false,
  );
  assert.equal(
    validateCollection(
      { discovered: 3, products: [item(), item(), item()], errors: [] },
      { sync: { productCount: 10 } },
    ).ok,
    false,
  );
});

test("publica produtos com estoque aplicando os preços de Torcedor e Jogador", () => {
  const state = {
    products: [
      item(2, "Camisa Torcedor"),
      { ...item(1, "Camisa Jogador"), supplierId: "11" },
    ],
    sync: {},
  };
  applySalesPolicy(state);
  assert.deepEqual(
    state.products.map(({ salePrice, visibility }) => ({
      salePrice,
      visibility,
    })),
    [
      { salePrice: 180, visibility: "published" },
      { salePrice: 250, visibility: "published" },
    ],
  );
});

test("remove da vitrine produto sem nenhum tamanho disponível", () => {
  const state = {
    products: [
      {
        ...item(0, "Camisa Torcedor"),
        salePrice: 180,
        visibility: "published",
      },
    ],
    sync: {},
  };
  applySalesPolicy(state);
  assert.equal(state.products[0].visibility, "draft");
  assert.equal(makePublicCatalog(state).products.length, 0);
});
