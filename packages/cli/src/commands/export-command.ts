import type { Command } from "commander";
import { summarizeSpec } from "@specora/core";
import type { OutputFormat } from "../types/cli-types.js";
import { generatePreviewHtml } from "../server/preview-html.js";
import { parseFromFile, writeTextFile } from "../utils/io.js";
import { normalizeOutputFormat, printFailure } from "../utils/output.js";

export function registerExportCommand(program: Command): void {
  program
    .command("export")
    .description("Export a static HTML preview from an OpenAPI file")
    .argument("<specPath>", "Path to spec file")
    .option("-o, --output <outputPath>", "Output HTML path", "dist/specora-preview.html")
    .option("-f, --format <format>", "Output format: text or json", "text")
    .action(async (specPath, options: { output: string; format: OutputFormat }) => {
      const format = normalizeOutputFormat(options.format);
      const { result } = await parseFromFile(specPath);
      if (!result.ok) {
        printFailure("Export failed", result.error.message, result.error.hint, format);
        process.exitCode = 1;
        return;
      }

      const summary = summarizeSpec(result.spec);
      const html = generatePreviewHtml({ summary, spec: result.spec });
      const outputPath = await writeTextFile(options.output, html);

      if (format === "json") {
        console.log(JSON.stringify({ ok: true, outputPath, summary }, null, 2));
        return;
      }

      console.log(`Exported preview to ${outputPath}`);
    });
}
