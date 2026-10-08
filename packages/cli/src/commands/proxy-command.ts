import type { Command } from "commander";
import { DEFAULT_ALLOWED_ORIGINS, startProxyServer } from "../server/proxy-server.js";

function collect(value: string, previous: string[]): string[] {
  return [...previous, ...value.split(",").map((origin) => origin.trim()).filter(Boolean)];
}

export function registerProxyCommand(program: Command): void {
  program
    .command("proxy")
    .description("Run a local CORS-friendly proxy for try-out requests")
    .option("-p, --port <port>", "Port", "8787")
    .option("--host <host>", "Bind host (use 0.0.0.0 only on trusted networks)", "127.0.0.1")
    .option(
      "--allow-origin <origin>",
      "Additional browser origin allowed to use the proxy (repeatable, comma-separated). Localhost is always allowed.",
      collect,
      []
    )
    .action(async (options: { port: string; host: string; allowOrigin: string[] }) => {
      const port = Number.parseInt(options.port, 10);
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        console.error(`Invalid port: ${options.port}`);
        process.exitCode = 1;
        return;
      }
      if (options.allowOrigin.includes("*")) {
        console.warn("Warning: --allow-origin * lets any website you visit send requests through this proxy.");
      }
      startProxyServer({
        port,
        host: options.host,
        allowedOrigins: [...DEFAULT_ALLOWED_ORIGINS, ...options.allowOrigin]
      });
    });
}
