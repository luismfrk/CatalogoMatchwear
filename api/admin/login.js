import { handleAdminApi } from "../../src/admin/http.js";

export default async function handler(request, response) {
  await handleAdminApi(request, response);
}
