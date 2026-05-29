# Replace Swagger UI with Specora embed

Use Specora when your repo already generates OpenAPI (OpenAPI Generator, Swaggo, etc.) and you want interactive docs at a path like `/api-docs` without shipping Swagger UI.

## Node (Express)

```ts
import express from "express";
import { specoraDocs } from "@specora/sdk-node";

const app = express();

app.use(
  specoraDocs({
    specPath: "./openapi.yaml",
    mountPath: "/api-docs",
    publicFilter: "tag:public",
  })
);
```

## Python (FastAPI)

```python
from fastapi import FastAPI
from specora.fastapi import mount_specora

app = FastAPI()
mount_specora(app, spec_path="./openapi.yaml", mount_path="/api-docs")
```

## Go

```bash
go get github.com/sahilkhaire/specora/packages/sdk-go@latest
```

```go
import (
    "net/http"
    "github.com/sahilkhaire/specora/packages/sdk-go/specora"
)

http.Handle("/api-docs/", specora.Handler(specora.Config{
    SpecPath:  "./openapi.yaml",
    MountPath: "/api-docs",
}))
```

See [packages/sdk-go/README.md](../packages/sdk-go/README.md) for framework examples and options.

## Embed UX (read-only)

Try-out (params, headers, body, auth, send) is **enabled** in SDK embed when a spec is loaded from `specUrl`. Use the settings menu for proxy/CORS options, or run `npx specora proxy --port 8787` locally.

Read-only in SDK embed (no full API client workbench):

- No workspace switcher or create-workspace controls
- No Import OpenAPI spec, New request, or Import Postman actions

## Download canonical spec files

The SDK injects `downloadJsonUrl` and (when applicable) `downloadYamlUrl` into `window.__SPECORA_EMBED__`. The settings menu shows **Download JSON** / **Download YAML** links that navigate to your backend routes — always the authoritative source files on disk, not in-browser state from try-out sessions.

Defaults for `@specora/sdk-node`:

- JSON: `{mountPath}/openapi.json`
- YAML: `{mountPath}/openapi.yaml` when `specPath` ends with `.yaml` or `.yml`

Override with `downloadJsonUrl` / `downloadYamlUrl` in `specoraDocs({ ... })` if canonical files are hosted elsewhere.

## CLI preview

```bash
specora docs --spec ./openapi.yaml --mount /api-docs
```

## CDN updates

SDK packages load the UI from `https://specora.varcore.dev/embed/latest`. Run `npm run publish:embed-cdn` after each web release and upload `dist/embed/` to that path on your host so developers pick up UI changes without republishing npm/PyPI/Go modules.
