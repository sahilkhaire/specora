import type { Command } from "commander";
import { summarizeSpec } from "@specora/core";
import { generatePreviewHtml } from "../server/preview-html.js";
import { startPreviewServer } from "../server/preview-server.js";
import { parseFromFile } from "../utils/io.js";

export function registerServeCommand(program: Command): void {
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
      const html = generatePreviewHtml({ summary, spec: result.spec });
      const port = Number.parseInt(options.port, 10);
      startPreviewServer(port, html);
    });
}
