import test from "node:test";
import assert from "node:assert/strict";
import { parseProduct } from "../src/sync/supplier.js";

test("prioriza a galeria principal e ignora JSON-LD relacionado", () => {
  const html = `
    <h1>Camisa Principal</h1>
    <meta property="og:image" content="http://cdn.example/main-og.webp">
    <div class="js-product-slide"><img data-zoom="//cdn.example/main-gallery.webp"></div>
    <script type="application/ld+json">{"@type":"Product","name":"Camisa Relacionada","image":"https://cdn.example/wrong.webp"}</script>
    <script>LS.product = { id : 123, name : 'Camisa Principal' };
    LS.variants = [{"product_id":123,"stock":2,"available":true,"option0":"M","id":456,"image_url":"//cdn.example/main-variant.webp"}];</script>`;
  const product = parseProduct(
    html,
    "https://supplier.example/produtos/camisa-principal/",
  );
  assert.equal(product.name, "Camisa Principal");
  assert.equal(product.images[0], "https://cdn.example/main-gallery.webp");
  assert.equal(
    product.images.includes("https://cdn.example/wrong.webp"),
    false,
  );
  assert.equal(product.sizes[0].status, "available");
});
