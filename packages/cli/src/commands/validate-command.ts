import type { Command } from "commander";
import { summarizeSpec } from "@specora/core";
import type { OutputFormat } from "../types/cli-types.js";
import { parseFromFile } from "../utils/io.js";
import { normalizeOutputFormat, printFailure } from "../utils/output.js";

export function registerValidateCommand(program: Command): void {
  program
    .command("validate")
    .description("Validate an OpenAPI JSON/YAML file")
    .argument("<specPath>", "Path to spec file")
    .option("-f, --format <format>", "Output format: text or json", "text")
    .action(async (specPath, options: { format: OutputFormat }) => {
      const format = normalizeOutputFormat(options.format);
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
}
