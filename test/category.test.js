import test from "node:test";
import assert from "node:assert/strict";
import { makePublicCatalog, mergeState } from "../src/sync/catalog.js";

test("normaliza categorias do fornecedor para a navegação da Matchwear", () => {
  const product = {
    supplierId: "category-test",
    name: "Camisa X",
    images: ["x.jpg"],
    category: "Times Brasileiros",
    sourceUrl: "https://supplier/x",
    sizes: [{ variantId: "1", name: "M", status: "available", quantity: 1 }],
  };
  const state = mergeState(null, [product]);
  state.products[0].salePrice = 149.9;
  state.products[0].visibility = "published";
  assert.equal(makePublicCatalog(state).products[0].category, "Brasileiros");
});
