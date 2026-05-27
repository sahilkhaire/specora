#!/usr/bin/env node
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { Command } from "commander";
import { parseAndValidateSpec, summarizeSpec } from "@specora/core";
import YAML from "yaml";

const program = new Command();
type OutputFormat = "text" | "json";

program
  .name("specora")
  .description("Specora CLI for OpenAPI validation, preview, and export")
  .version("0.1.0");

program.showHelpAfterError();

async function readSpecText(specPath: string): Promise<string> {
  const absolute = path.resolve(specPath);
  return fs.readFile(absolute, "utf8");
}

function generateHtml(summary: {
  title: string;
  version: string;
  endpointCount: number;
  tags: string[];
}, rawSpec: Record<string, unknown>): string {
  const prettySpec = JSON.stringify(rawSpec, null, 2);
  const tags = summary.tags.length > 0 ? summary.tags.join(", ") : "No tags";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${summary.title} - Specora Preview</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 2rem; color: #102a43; background: #f4f8fb; }
    .card { background: #fff; border: 1px solid #d9e2ec; border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; box-shadow: 0 10px 25px rgba(16, 42, 67, 0.05); }
    h1 { margin: 0 0 0.75rem 0; }
    code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    pre { white-space: pre-wrap; background: #102a43; color: #f0f4f8; padding: 1rem; border-radius: 10px; overflow: auto; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${summary.title}</h1>
    <p><strong>Version:</strong> ${summary.version}</p>
    <p><strong>Paths:</strong> ${summary.endpointCount}</p>
    <p><strong>Tags:</strong> ${tags}</p>
  </div>
  <div class="card">
    <h2>Raw Spec</h2>
    <pre>${prettySpec}</pre>
  </div>
</body>
</html>`;
}

async function parseFromFile(specPath: string) {
  const text = await readSpecText(specPath);

  const result = await parseAndValidateSpec({
    sourceType: "text",
    value: text
  });

  return { result, text };
}

function printFailure(prefix: string, message: string, hint: string | undefined, format: OutputFormat): void {
  if (format === "json") {
    console.log(JSON.stringify({ ok: false, error: { prefix, message, hint } }, null, 2));
    return;
  }

  console.error(`${prefix}: ${message}`);
  if (hint) {
    console.error(`Hint: ${hint}`);
  }
}

function applyCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) {
    return {};
  }

  return JSON.parse(raw) as Record<string, unknown>;
}

program
  .command("validate")
  .description("Validate an OpenAPI JSON/YAML file")
  .argument("<specPath>", "Path to spec file")
  .option("-f, --format <format>", "Output format: text or json", "text")
  .action(async (specPath, options: { format: OutputFormat }) => {
    const format = options.format === "json" ? "json" : "text";
    const { result } = await parseFromFile(specPath);
    if (!result.ok) {
      printFailure("Validation failed", result.error.message, result.error.hint, format);
      process.exitCode = 1;
      return;
    }

    const summary = summarizeSpec(result.spec);
    if (format === "json") {
      console.log(JSON.stringify({ ok: true, summary }, null, 2));
      return;
    }

    console.log("Validation successful");
    console.log(JSON.stringify(summary, null, 2));
  });

program
  .command("export")
  .description("Export a static HTML preview from an OpenAPI file")
  .argument("<specPath>", "Path to spec file")
  .option("-o, --output <outputPath>", "Output HTML path", "dist/specora-preview.html")
  .option("-f, --format <format>", "Output format: text or json", "text")
  .action(async (specPath, options: { output: string; format: OutputFormat }) => {
    const format = options.format === "json" ? "json" : "text";
    const { result } = await parseFromFile(specPath);
    if (!result.ok) {
      printFailure("Export failed", result.error.message, result.error.hint, format);
      process.exitCode = 1;
      return;
    }

    const outputPath = path.resolve(options.output);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const summary = summarizeSpec(result.spec);
    const html = generateHtml(summary, result.spec);
    await fs.writeFile(outputPath, html, "utf8");

    if (format === "json") {
      console.log(JSON.stringify({ ok: true, outputPath, summary }, null, 2));
      return;
    }

    console.log(`Exported preview to ${outputPath}`);
  });

program
  .command("serve")
  .description("Serve a local OpenAPI HTML preview")
  .argument("<specPath>", "Path to spec file")
  .option("-p, --port <port>", "Port", "4173")
  .action(async (specPath, options: { port: string }) => {
    const { result } = await parseFromFile(specPath);
    if (!result.ok) {
      console.error(`Serve failed: ${result.error.message}`);
      process.exitCode = 1;
      return;
    }

    const summary = summarizeSpec(result.spec);
    const html = generateHtml(summary, result.spec);

    const port = Number.parseInt(options.port, 10);
    const server = createServer((_req: IncomingMessage, res: ServerResponse) => {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(html);
    });

    server.listen(port, () => {
      console.log(`Specora preview running at http://localhost:${port}`);
    });
  });

program
  .command("proxy")
  .description("Run a local CORS-friendly proxy for try-out requests")
  .option("-p, --port <port>", "Port", "8787")
  .action(async (options: { port: string }) => {
    const port = Number.parseInt(options.port, 10);
    const proxyServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      applyCorsHeaders(res);

      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }

      if (req.method !== "POST" || req.url !== "/proxy") {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ ok: false, error: "Use POST /proxy" }));
        return;
      }

      try {
        const payload = await readJsonBody(req);
        const url = typeof payload.url === "string" ? payload.url : "";
        const method = typeof payload.method === "string" ? payload.method.toUpperCase() : "GET";
        const headers = (payload.headers && typeof payload.headers === "object")
          ? payload.headers as Record<string, string>
          : {};
        const body = typeof payload.body === "string" ? payload.body : undefined;

        if (!url) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ ok: false, error: "Field 'url' is required." }));
          return;
        }

        const response = await fetch(url, {
          method,
          headers,
          body: ["GET", "HEAD"].includes(method) ? undefined : body
        });

        const responseText = await response.text();
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        res.statusCode = response.ok ? 200 : 502;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({
          ok: response.ok,
          status: response.status,
          headers: responseHeaders,
          body: responseText,
          error: response.ok ? undefined : `Target returned HTTP ${response.status}`
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Proxy request failed";
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ ok: false, error: message }));
      }
    });

    proxyServer.listen(port, () => {
      console.log(`Specora proxy listening at http://localhost:${port}/proxy`);
    });
  });

program
  .command("inspect")
  .description("Inspect summary information from JSON or YAML content")
  .argument("<content>", "Raw JSON/YAML spec text")
  .action(async (content) => {
    let text = content;
    if (content.startsWith("@")) {
      text = await readSpecText(content.slice(1));
    }

    let normalized = text;
    if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) {
      const asJson = YAML.parse(text);
      normalized = JSON.stringify(asJson, null, 2);
    }

    const result = await parseAndValidateSpec({ sourceType: "text", value: normalized });
    if (!result.ok) {
      console.error(`Inspect failed: ${result.error.message}`);
      process.exitCode = 1;
      return;
    }

    console.log(JSON.stringify(summarizeSpec(result.spec), null, 2));
  });

if (process.argv.length <= 2) {
  program.outputHelp();
  process.exit(0);
}

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown CLI error";
  console.error(`CLI execution failed: ${message}`);
  process.exit(1);
});
