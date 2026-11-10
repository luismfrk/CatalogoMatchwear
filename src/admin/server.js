import "dotenv/config";
import { createServer } from "node:http";
import { handleAdminApi } from "./http.js";

const port = Number(process.env.PORT || 4174);
createServer(async (req, res) => {
  if (await handleAdminApi(req, res)) return;
  res.statusCode = 404;
  res.end("Not found");
}).listen(port, () => console.log(`API administrativa na porta ${port}`));
