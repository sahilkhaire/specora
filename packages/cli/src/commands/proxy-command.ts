import type { Command } from "commander";
import { startProxyServer } from "../server/proxy-server.js";

export function registerProxyCommand(program: Command): void {
  program
    .command("proxy")
    .description("Run a local CORS-friendly proxy for try-out requests")
    .option("-p, --port <port>", "Port", "8787")
    .action(async (options: { port: string }) => {
      const port = Number.parseInt(options.port, 10);
      startProxyServer(port);
    });
}
