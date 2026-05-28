import type { Command } from "commander";
import { summarizeSpec } from "@specora/core";
import { parseFromFile } from "../utils/io.js";

interface DocsCommandOptions {
  spec: string;
  mount: string;
  port: string;
  host: string;
}

export function registerDocsCommand(program: Command): void {
  program
    .command("docs")
    .description("Serve public API docs from an OpenAPI spec (Swagger UI replacement)")
    .requiredOption("-s, --spec <path>", "Path to openapi.yaml or swagger.json")
    .option("-m, --mount <path>", "URL path to mount docs", "/api-docs")
    .option("-p, --port <number>", "HTTP port", "8789")
    .option("--host <host>", "Bind host", "127.0.0.1")
    .action(async (options: DocsCommandOptions) => {
      const { result } = await parseFromFile(options.spec);
      if (!result.ok) {
        throw new Error(result.error.message);
      }

      const summary = summarizeSpec(result.spec);
      if (summary.endpointCount === 0) {
        console.warn("No endpoints found in spec.");
      }

      const { createServer } = await import("node:http");
      const mount = options.mount.endsWith("/") ? options.mount.slice(0, -1) : options.mount;
      const port = Number(options.port);

      const server = createServer((req, res) => {
        const url = req.url ?? "/";
        if (url === mount || url === `${mount}/`) {
          res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          res.end(`<!doctype html>
<html><head><meta charset="utf-8"/><title>Specora Docs</title></head>
<body>
  <p>Specora docs CLI preview. Mount: ${mount}</p>
  <p>Endpoints: ${summary.endpointCount}</p>
  <p>Run <code>specora serve</code> for the full interactive UI, or use @specora/sdk-node in your app.</p>
</body></html>`);
          return;
        }
        if (url === `${mount}/openapi.json`) {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify(result.spec));
          return;
        }
        res.writeHead(404).end("Not found");
      });

      await new Promise<void>((resolve) => {
        server.listen(port, options.host, () => {
          console.log(`Specora docs listening at http://${options.host}:${port}${mount}`);
          resolve();
        });
      });
    });
}
