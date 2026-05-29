import { readFile } from "node:fs/promises";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import {
  buildBootstrapHtml,
  readSpecFile,
  resolveEmbedAssets,
  watchSpecFile,
  type EmbedCoreOptions,
} from "@specora/embed-core";

export interface SpecoraDocsOptions extends EmbedCoreOptions {
  mountPath?: string;
}

function isYamlSpecPath(specPath: string): boolean {
  return /\.ya?ml$/i.test(specPath);
}

export function specoraDocs(options: SpecoraDocsOptions): RequestHandler {
  const mountPath = (options.mountPath ?? "/api-docs").replace(/\/$/, "");
  let cachedHtml: string | null = null;
  let specCache: Record<string, unknown> | null = null;

  const downloadJsonUrl = options.downloadJsonUrl ?? `${mountPath}/openapi.json`;
  const downloadYamlUrl =
    options.downloadYamlUrl ??
    (isYamlSpecPath(options.specPath) ? `${mountPath}/openapi.yaml` : undefined);

  async function loadAssets(): Promise<void> {
    const assets = await resolveEmbedAssets(options);
    const specUrl = `${mountPath}/openapi.json`;
    cachedHtml = buildBootstrapHtml(assets.indexHtml, {
      ...options,
      specUrl,
      mountPath,
      downloadJsonUrl,
      downloadYamlUrl,
    });
  }

  void loadAssets().catch((error) => {
    console.error("[specora] Failed to load embed assets:", error);
  });

  if (options.watch) {
    watchSpecFile(options.specPath, () => {
      specCache = null;
      void loadAssets();
    });
  }

  return async function specoraDocsMiddleware(req: Request, res: Response, next: NextFunction) {
    const url = req.url.split("?")[0] ?? "";

    if (url === `${mountPath}/openapi.json` || url === "/openapi.json") {
      try {
        if (!specCache) {
          specCache = await readSpecFile(options.specPath);
        }
        res.setHeader("content-type", "application/json");
        res.send(specCache);
        return;
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : "Failed to read spec",
        });
        return;
      }
    }

    if (
      downloadYamlUrl &&
      (url === `${mountPath}/openapi.yaml` || url === "/openapi.yaml")
    ) {
      try {
        const raw = await readFile(options.specPath, "utf8");
        res.setHeader("content-type", "application/yaml; charset=utf-8");
        res.send(raw);
        return;
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : "Failed to read spec",
        });
        return;
      }
    }

    if (url === mountPath || url === `${mountPath}/` || url === "/") {
      if (!cachedHtml) {
        await loadAssets();
      }
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.send(cachedHtml ?? "<html><body>Specora embed loading…</body></html>");
      return;
    }

    next();
  };
}

export { specoraDocs as default };
