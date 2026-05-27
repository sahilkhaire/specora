import process from "node:process";
import { Command } from "commander";
import { registerExportCommand } from "../commands/export-command.js";
import { registerInspectCommand } from "../commands/inspect-command.js";
import { registerProxyCommand } from "../commands/proxy-command.js";
import { registerServeCommand } from "../commands/serve-command.js";
import { registerValidateCommand } from "../commands/validate-command.js";

function createProgram(): Command {
  const program = new Command();

  program
    .name("specora")
    .description("Specora CLI for OpenAPI validation, preview, and export")
    .version("0.1.0");

  program.showHelpAfterError();

  registerValidateCommand(program);
  registerExportCommand(program);
  registerServeCommand(program);
  registerProxyCommand(program);
  registerInspectCommand(program);

  return program;
}

export async function runCli(argv: string[]): Promise<void> {
  const program = createProgram();

  if (argv.length <= 2) {
    program.outputHelp();
    return;
  }

  await program.parseAsync(argv).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown CLI error";
    console.error(`CLI execution failed: ${message}`);
    process.exit(1);
  });
}
