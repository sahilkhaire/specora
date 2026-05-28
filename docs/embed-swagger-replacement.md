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

```go
http.Handle("/api-docs/", specora.Handler(specora.Config{
    SpecPath: "./openapi.yaml",
}))
```

## CLI preview

```bash
specora docs --spec ./openapi.yaml --mount /api-docs
```

## CDN updates

SDK packages load the UI from `https://cdn.specora.doc/embed/latest`. Run `npm run publish:embed-cdn` after each web release so developers pick up UI changes without republishing npm/PyPI/Go modules.
