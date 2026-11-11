import { handleAdminApi } from "../src/admin/http.js";

export default async function handler(request, response) {
  if (await handleAdminApi(request, response)) return;
  response.statusCode = 404;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify({ error: "Rota não encontrada." }));
}
