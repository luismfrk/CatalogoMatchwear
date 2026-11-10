const config = window.MATCHWEAR_CONFIG || {};
const ids = [
  "grid",
  "status",
  "search",
  "category",
  "size",
  "sort",
  "count",
  "sync",
  "heroImage",
  "productDialog",
  "dialogContent",
  "categoryChips",
  "favoritesButton",
  "favoritesCount",
  "favoritesMode",
  "clearFavoritesMode",
  "cartButton",
  "cartCount",
  "cartDialog",
  "cartItems",
  "cartSummary",
  "closeCart",
];
const ui = Object.fromEntries(
  ids.map((id) => [id, document.getElementById(id)]),
);
let catalog;
let products = [];
let favorites = readLocal("matchwear:favorites", []);
let cart = readLocal("matchwear:cart", []);
let favoritesOnly = false;

const money = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
const stockLabel = (status) =>
  status === "available"
    ? "Disponível"
    : status === "sold_out"
      ? "Esgotado"
      : "Disponibilidade a confirmar";

try {
  const response = await fetch(config.catalogUrl || "/catalog.json", {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  catalog = await response.json();
  products = catalog.products || [];
  reconcileSavedItems();
  setup();
  render();
  openHashProduct();
} catch (error) {
  ui.status.hidden = false;
  ui.status.textContent =
    "Não foi possível carregar o catálogo agora. Tente novamente em instantes.";
  console.error(error);
}

function readLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}
function saveLocal() {
  localStorage.setItem("matchwear:favorites", JSON.stringify(favorites));
  localStorage.setItem("matchwear:cart", JSON.stringify(cart));
  updateCounters();
}
function reconcileSavedItems() {
  const validIds = new Set(products.map((product) => String(product.id)));
  favorites = favorites.filter((id) => validIds.has(String(id)));
  cart = cart.filter((item) => validIds.has(String(item.id)));
  saveLocal();
}

function setup() {
  const categories = [
    ...new Set(products.map((product) => product.category).filter(Boolean)),
  ].sort();
  const sizes = [
    ...new Set(
      products.flatMap((product) => product.sizes.map((size) => size.name)),
    ),
  ].sort();
  categories.forEach((value) => ui.category.add(new Option(value, value)));
  sizes.forEach((value) => ui.size.add(new Option(value, value)));
  ui.categoryChips.innerHTML = ["", ...categories]
    .map(
      (value) =>
        `<button type="button" data-category="${escapeHtml(value)}" class="${value === "" ? "active" : ""}">${value || "Todos"}</button>`,
    )
    .join("");
  ui.categoryChips.querySelectorAll("button").forEach((button) =>
    button.addEventListener("click", () => {
      ui.category.value = button.dataset.category;
      render();
    }),
  );
  [ui.search, ui.category, ui.size, ui.sort].forEach((element) =>
    element.addEventListener("input", render),
  );
  ui.favoritesButton.addEventListener("click", () => {
    favoritesOnly = !favoritesOnly;
    ui.favoritesMode.hidden = !favoritesOnly;
    render();
    document.querySelector("#catalogo").scrollIntoView();
  });
  ui.clearFavoritesMode.addEventListener("click", () => {
    favoritesOnly = false;
    ui.favoritesMode.hidden = true;
    render();
  });
  ui.cartButton.addEventListener("click", openCart);
  ui.closeCart.addEventListener("click", () => ui.cartDialog.close());
  ui.cartDialog.addEventListener("click", (event) => {
    if (event.target === ui.cartDialog) ui.cartDialog.close();
  });
  document
    .querySelector("#productDialog .close")
    .addEventListener("click", () => ui.productDialog.close());
  ui.productDialog.addEventListener("click", (event) => {
    if (event.target === ui.productDialog) ui.productDialog.close();
  });
  if (products[0]?.images[0]) {
    ui.heroImage.src = products[0].images[0];
    ui.heroImage.alt = products[0].name;
    ui.heroImage.hidden = false;
  }
  if (catalog.lastSuccessfulSyncAt)
    ui.sync.textContent = `Catálogo atualizado em ${new Date(catalog.lastSuccessfulSyncAt).toLocaleString("pt-BR")}`;
  updateCounters();
}

function render() {
  const query = ui.search.value.trim().toLowerCase();
  let filtered = products.filter(
    (product) =>
      (!query || product.name.toLowerCase().includes(query)) &&
      (!ui.category.value || product.category === ui.category.value) &&
      (!ui.size.value ||
        product.sizes.some(
          (size) => size.name === ui.size.value && size.status !== "sold_out",
        )) &&
      (!favoritesOnly || favorites.includes(String(product.id))),
  );
  if (ui.sort.value === "price-asc") filtered.sort((a, b) => a.price - b.price);
  if (ui.sort.value === "price-desc")
    filtered.sort((a, b) => b.price - a.price);
  if (ui.sort.value === "name")
    filtered.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  ui.categoryChips
    .querySelectorAll("button")
    .forEach((button) =>
      button.classList.toggle(
        "active",
        button.dataset.category === ui.category.value,
      ),
    );
  ui.count.textContent = `${filtered.length} ${filtered.length === 1 ? "produto" : "produtos"}`;
  ui.grid.innerHTML = filtered.map(productCard).join("");
  ui.grid.querySelectorAll(".card").forEach(wireCard);
  ui.status.hidden = Boolean(filtered.length);
  ui.status.textContent = filtered.length
    ? ""
    : favoritesOnly
      ? "Você ainda não adicionou camisas aos favoritos."
      : "Nenhuma camisa encontrada com esses filtros.";
}

function sizeButtons(product) {
  return product.sizes
    .map(
      (size) =>
        `<button class="size ${size.status}" data-size="${escapeHtml(size.name)}" ${size.status === "sold_out" ? "disabled" : ""} aria-label="${escapeHtml(size.name)} — ${stockLabel(size.status)}">${escapeHtml(size.name)}</button>`,
    )
    .join("");
}

function productCard(product) {
  const soldOut =
    product.sizes.length > 0 &&
    product.sizes.every((size) => size.status === "sold_out");
  const favorite = favorites.includes(String(product.id));
  return `<article class="card" data-id="${product.id}"><div class="photo">
    <button class="favorite-toggle ${favorite ? "active" : ""}" type="button" aria-label="${favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}">${favorite ? "♥" : "♡"}</button>
    <button class="photo-link" type="button" aria-label="Ver detalhes de ${escapeHtml(product.name)}"><img loading="lazy" src="${escapeHtml(product.images[0] || "")}" alt="${escapeHtml(product.name)}"></button></div>
    <div class="card-body"><span class="tag">${escapeHtml(product.category)}</span><h3>${escapeHtml(product.name)}</h3><div class="price">${money(product.price)}</div><p class="size-label">Escolha o tamanho</p><div class="sizes">${sizeButtons(product)}</div><p class="stock-text">${soldOut ? "<strong>Produto sem estoque.</strong>" : "Selecione uma opção para ver o estoque."}</p><div class="card-actions"><button class="order" disabled>${soldOut ? "Sem estoque" : "Selecione o tamanho"}</button><button class="add-cart" disabled aria-label="Adicionar à sacola">＋</button></div></div></article>`;
}

function wireCard(card) {
  const product = products.find((item) => String(item.id) === card.dataset.id);
  const photo = card.querySelector(".photo-link");
  let selected;
  photo.addEventListener("click", () => openProduct(product));
  card
    .querySelector(".favorite-toggle")
    .addEventListener("click", () => toggleFavorite(product.id));
  card.querySelectorAll(".size:not(:disabled)").forEach((button) =>
    button.addEventListener("click", () => {
      card
        .querySelectorAll(".size")
        .forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      selected = product.sizes.find(
        (option) => option.name === button.dataset.size,
      );
      updateOrder(card, selected);
    }),
  );
  card
    .querySelector(".order")
    .addEventListener("click", () => openWhatsApp(product, selected));
  card
    .querySelector(".add-cart")
    .addEventListener("click", () => addToCart(product, selected));
}

function updateOrder(container, selected) {
  const order = container.querySelector(".order");
  const add = container.querySelector(".add-cart");
  order.disabled = false;
  add.disabled = false;
  order.textContent =
    selected.status === "unknown"
      ? "Consultar pelo WhatsApp"
      : "Pedir pelo WhatsApp";
  container.querySelector(".stock-text").innerHTML =
    `<strong>${escapeHtml(selected.name)}:</strong> ${stockLabel(selected.status)}.`;
}

function toggleFavorite(id) {
  const value = String(id);
  favorites = favorites.includes(value)
    ? favorites.filter((item) => item !== value)
    : [...favorites, value];
  saveLocal();
  render();
}

function addToCart(product, selected) {
  if (!selected || selected.status === "sold_out") return;
  const found = cart.find(
    (item) =>
      String(item.id) === String(product.id) && item.size === selected.name,
  );
  if (found) found.quantity += 1;
  else cart.push({ id: String(product.id), size: selected.name, quantity: 1 });
  saveLocal();
  openCart();
}

function updateCounters() {
  ui.favoritesCount.textContent = favorites.length;
  ui.cartCount.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
}

function productLink(product) {
  return `${catalog.siteUrl || location.origin}${location.pathname}#produto-${product.id}`;
}
function openWhatsApp(product, selected) {
  if (!selected) return;
  const action =
    selected.status === "unknown"
      ? "Olá! Quero consultar a disponibilidade"
      : "Olá! Quero pedir";
  openWhatsAppMessage(
    `${action} da ${product.name}, tamanho ${selected.name}.\n${productLink(product)}`,
  );
}
function openWhatsAppMessage(message) {
  const phone = String(catalog.whatsappNumber).replace(/\D/g, "");
  window.open(
    `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener",
  );
}

function openCart() {
  renderCart();
  ui.cartDialog.showModal();
}
function renderCart() {
  const resolved = cart
    .map((item) => ({
      ...item,
      product: products.find(
        (product) => String(product.id) === String(item.id),
      ),
    }))
    .filter((item) => item.product);
  if (!resolved.length) {
    ui.cartItems.innerHTML =
      '<div class="empty-cart"><h3>Sua sacola está vazia</h3><p>Escolha uma camisa e um tamanho para começar.</p></div>';
    ui.cartSummary.innerHTML = "";
    return;
  }
  ui.cartItems.innerHTML = resolved
    .map(
      (item) =>
        `<article class="cart-item" data-id="${item.id}" data-size="${escapeHtml(item.size)}"><img src="${escapeHtml(item.product.images[0] || "")}" alt=""><div><h3>${escapeHtml(item.product.name)}</h3><p>Tamanho ${escapeHtml(item.size)} · ${money(item.product.price)}</p></div><div class="cart-quantity"><button data-action="minus">−</button><b>${item.quantity}</b><button data-action="plus">+</button></div><button class="remove-cart" data-action="remove" aria-label="Remover">×</button></article>`,
    )
    .join("");
  const total = resolved.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );
  const unavailable = resolved.some(
    (item) =>
      item.product.sizes.find((size) => size.name === item.size)?.status ===
      "sold_out",
  );
  ui.cartSummary.innerHTML = `<div class="cart-total"><span>Total estimado</span><strong>${money(total)}</strong></div>${unavailable ? '<p class="stock-text"><strong>Há tamanho esgotado na sacola.</strong> Remova-o antes de finalizar.</p>' : ""}<button class="cart-checkout" ${unavailable ? "disabled" : ""}>Finalizar pelo WhatsApp</button>`;
  ui.cartItems
    .querySelectorAll("[data-action]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        changeCart(button.closest(".cart-item"), button.dataset.action),
      ),
    );
  ui.cartSummary
    .querySelector(".cart-checkout")
    .addEventListener("click", () => checkoutCart(resolved, total));
}
function changeCart(row, action) {
  const item = cart.find(
    (entry) =>
      String(entry.id) === row.dataset.id && entry.size === row.dataset.size,
  );
  if (!item) return;
  if (action === "plus") item.quantity += 1;
  if (action === "minus") item.quantity = Math.max(1, item.quantity - 1);
  if (action === "remove") cart = cart.filter((entry) => entry !== item);
  saveLocal();
  renderCart();
}
function checkoutCart(items, total) {
  const lines = items
    .map(
      (item) =>
        `• ${item.product.name}\n  Tamanho: ${item.size} · Quantidade: ${item.quantity}\n  ${productLink(item.product)}`,
    )
    .join("\n\n");
  openWhatsAppMessage(
    `Olá! Quero pedir estas camisas:\n\n${lines}\n\nTotal estimado: ${money(total)}`,
  );
}

function openProduct(product) {
  const soldOut =
    product.sizes.length > 0 &&
    product.sizes.every((size) => size.status === "sold_out");
  const favorite = favorites.includes(String(product.id));
  ui.dialogContent.innerHTML = `<div class="product-detail"><section class="gallery" aria-label="Galeria de ${escapeHtml(product.name)}"><div class="gallery-thumbs">${product.images.map((image, index) => `<button class="gallery-thumb ${index === 0 ? "selected" : ""}" data-image="${escapeHtml(image)}" aria-label="Ver foto ${index + 1}"><img src="${escapeHtml(image)}" alt=""></button>`).join("")}</div><div class="gallery-main"><img src="${escapeHtml(product.images[0] || "")}" alt="${escapeHtml(product.name)}"></div></section>
    <section class="detail-info"><span class="tag">${escapeHtml(product.category)}</span><h2 id="dialogTitle">${escapeHtml(product.name)}</h2><p class="price">${money(product.price)}</p><button class="favorite-detail secondary" type="button">${favorite ? "♥ Remover dos favoritos" : "♡ Salvar nos favoritos"}</button><p class="size-label">Selecione o tamanho</p><div class="sizes">${sizeButtons(product)}</div><p class="stock-text">${soldOut ? "<strong>Produto sem estoque.</strong> Todos os tamanhos estão esgotados." : "Selecione uma opção para ver o estoque. Tamanhos riscados estão esgotados."}</p><div class="detail-actions"><button class="order" disabled>${soldOut ? "Sem estoque" : "Selecione o tamanho"}</button><button class="add-cart" disabled aria-label="Adicionar à sacola">＋</button></div></section></div>`;
  wireProductDetail(product);
  ui.productDialog.showModal();
  history.replaceState(null, "", `#produto-${product.id}`);
}

function wireProductDetail(product) {
  const detail = ui.dialogContent.querySelector(".product-detail");
  let selected;
  detail.querySelectorAll(".gallery-thumb").forEach((button) =>
    button.addEventListener("click", () => {
      detail
        .querySelectorAll(".gallery-thumb")
        .forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      detail.querySelector(".gallery-main img").src = button.dataset.image;
    }),
  );
  detail.querySelector(".favorite-detail").addEventListener("click", () => {
    toggleFavorite(product.id);
    ui.productDialog.close();
    openProduct(product);
  });
  detail.querySelectorAll(".size:not(:disabled)").forEach((button) =>
    button.addEventListener("click", () => {
      detail
        .querySelectorAll(".size")
        .forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      selected = product.sizes.find(
        (option) => option.name === button.dataset.size,
      );
      updateOrder(detail, selected);
    }),
  );
  detail
    .querySelector(".order")
    .addEventListener("click", () => openWhatsApp(product, selected));
  detail
    .querySelector(".add-cart")
    .addEventListener("click", () => addToCart(product, selected));
}

function openHashProduct() {
  const match = location.hash.match(/^#produto-(\d+)$/);
  const product =
    match && products.find((item) => String(item.id) === match[1]);
  if (product) openProduct(product);
}
