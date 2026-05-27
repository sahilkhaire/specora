import type { Command } from "commander";
import { parseAndValidateSpec, summarizeSpec } from "@specora/core";
import YAML from "yaml";
import { readSpecText } from "../utils/io.js";

export function registerInspectCommand(program: Command): void {
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
}
