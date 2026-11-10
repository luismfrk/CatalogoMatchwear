const apiBase = (window.MATCHWEAR_CONFIG?.adminApiUrl || "").replace(/\/$/, "");
const byId = (id) => document.getElementById(id);
let token = sessionStorage.getItem("matchwearAdminToken") || "";
let allProducts = [];
let current;

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "Erro inesperado.");
  return value;
}

byId("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  byId("loginError").textContent = "";
  try {
    const result = await request("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password: byId("password").value }),
    });
    token = result.token;
    sessionStorage.setItem("matchwearAdminToken", token);
    await openPanel();
  } catch (error) {
    byId("loginError").textContent = error.message;
  }
});

async function openPanel() {
  try {
    byId("loginView").hidden = true;
    byId("panelView").hidden = false;
    await loadProducts();
  } catch (error) {
    logout();
    byId("loginError").textContent = error.message;
  }
}
async function loadProducts() {
  const result = await request("/api/admin/products?visibility=all");
  allProducts = result.products;
  byId("draftCount").textContent = allProducts.filter(
    (p) => p.visibility === "draft",
  ).length;
  byId("publishedCount").textContent = allProducts.filter(
    (p) => p.visibility === "published",
  ).length;
  byId("syncDate").textContent = result.sync?.lastSuccessfulAt
    ? new Date(result.sync.lastSuccessfulAt).toLocaleString("pt-BR")
    : "Nunca";
  render();
}
function render() {
  const query = byId("searchAdmin").value.toLowerCase();
  const visibility = byId("visibility").value;
  const products = allProducts.filter(
    (p) =>
      (visibility === "all" || p.visibility === visibility) &&
      p.name.toLowerCase().includes(query),
  );
  byId("products").innerHTML = products
    .map(
      (p) =>
        `<article class="product"><img src="${p.customImages?.[0] || p.images?.[0] || ""}" alt=""><div><small>${p.category} · ${p.visibility === "draft" ? "Rascunho" : "Publicado"}</small><h2>${p.name}</h2><strong>${p.salePrice ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.salePrice) : "Sem preço"}</strong><button data-id="${p.supplierId}">Revisar</button></div></article>`,
    )
    .join("");
  byId("products")
    .querySelectorAll("button")
    .forEach((button) =>
      button.addEventListener("click", () => edit(button.dataset.id)),
    );
}
function edit(id) {
  current = allProducts.find((p) => p.supplierId === id);
  byId("editorImage").src =
    current.customImages?.[0] || current.images?.[0] || "";
  byId("editorCategory").textContent = current.category;
  byId("editorName").textContent = current.name;
  byId("editorPrice").value = current.salePrice || "";
  byId("editorImages").value = (current.customImages || []).join("\n");
  byId("unpublish").style.display =
    current.visibility === "published" ? "block" : "none";
  byId("editor").showModal();
}
async function save(visibility) {
  byId("notice").textContent = "";
  const customImages = byId("editorImages")
    .value.split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean);
  try {
    await request(`/api/admin/products/${current.supplierId}`, {
      method: "PATCH",
      body: JSON.stringify({
        salePrice: byId("editorPrice").value,
        customImages,
        visibility,
      }),
    });
    byId("editor").close();
    byId("notice").textContent =
      visibility === "published" ? "Produto publicado." : "Rascunho salvo.";
    await loadProducts();
  } catch (error) {
    byId("notice").textContent = error.message;
  }
}
function logout() {
  token = "";
  sessionStorage.removeItem("matchwearAdminToken");
  byId("panelView").hidden = true;
  byId("loginView").hidden = false;
}
byId("searchAdmin").addEventListener("input", render);
byId("visibility").addEventListener("change", render);
byId("saveDraft").addEventListener("click", () => save("draft"));
byId("publish").addEventListener("click", () => save("published"));
byId("unpublish").addEventListener("click", () => save("draft"));
byId("closeEditor").addEventListener("click", () => byId("editor").close());
byId("logout").addEventListener("click", logout);
if (token) openPanel();
