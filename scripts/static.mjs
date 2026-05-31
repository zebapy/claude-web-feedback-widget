// Minimal static file server for the examples dir (browser-test helper only).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";

const root = new URL("../examples/", import.meta.url).pathname;
const port = Number(process.argv[2] ?? 8080);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

createServer(async (request, response) => {
  const path = (request.url ?? "/").split("?")[0];
  const file = join(root, path === "/" ? "demo.html" : path);
  const body = await readFile(file).catch(() => null);
  if (!body) {
    response.writeHead(404).end("not found");
    return;
  }
  response.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" }).end(body);
}).listen(port, "127.0.0.1", () => process.stdout.write(`static server on http://127.0.0.1:${port}\n`));
