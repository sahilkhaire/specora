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

## CLI preview

```bash
specora docs --spec ./openapi.yaml --mount /api-docs
```

## CDN updates

SDK packages load the UI from `https://specora.varcore.dev/embed/latest`. Run `npm run publish:embed-cdn` after each web release and upload `dist/embed/` to that path on your host so developers pick up UI changes without republishing npm/PyPI/Go modules.
