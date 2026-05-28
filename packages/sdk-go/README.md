# Specora Go SDK

Mount interactive OpenAPI documentation in any Go HTTP server — a lightweight alternative to Swagger UI.

The UI is loaded from the [Specora CDN](https://specora.varcore.dev/embed/latest) (`latest` by default), so you rarely need to republish this module when the docs UI improves.

## Install

```bash
go get github.com/sahilkhaire/specora/packages/sdk-go@latest
```

Requires **Go 1.22+**.

## Quick start

```go
package main

import (
	"log"
	"net/http"

	"github.com/sahilkhaire/specora/packages/sdk-go/specora"
)

func main() {
	http.Handle("/api-docs/", specora.Handler(specora.Config{
		SpecPath:  "./openapi.yaml",
		MountPath: "/api-docs",
	}))
	log.Fatal(http.ListenAndServe(":8080", nil))
}
```

Open `http://localhost:8080/api-docs/`.

### Standard library `ServeMux` note

Register with a trailing slash so subpaths are routed:

```go
http.Handle("/api-docs/", specora.Handler(...)) // correct
// http.Handle("/api-docs", ...)               // only matches exact path
```

## Configuration

| Field | Description | Default |
|-------|-------------|---------|
| `SpecPath` | Path or `https://` URL to OpenAPI / Swagger JSON or YAML | required |
| `MountPath` | URL prefix for docs | `/api-docs` |
| `EmbedDir` | Local embed bundle dir (`manifest.json` + `index.html`) | CDN |
| `CdnBase` | Embed CDN root | `https://specora.varcore.dev/embed` |
| `Version` | Bundle version (`latest` or `0.1.0`) | `latest` |
| `PublicFilter` | `tag:public`, `extension`, `no-security`, `all` | `tag:public` |
| `IncludeAll` | Show all operations | `false` |

## Framework examples

### Chi

```go
r.Mount("/api-docs", specora.Handler(specora.Config{SpecPath: "./openapi.yaml"}))
```

### Gin

```go
r.Any("/api-docs/*any", gin.WrapH(specora.Handler(specora.Config{SpecPath: "./openapi.yaml"})))
```

### Echo

```go
e.Any("/api-docs/*", echo.WrapHandler(specora.Handler(specora.Config{SpecPath: "./openapi.yaml"})))
```

## Local development (this monorepo)

The hosted CDN serves the main app; the **embed bundle** must exist under `/embed/latest/` (or use a local copy).

```bash
# From repo root — build embed UI into dist/embed/latest
npm run publish:embed-cdn

cd packages/sdk-go
go mod tidy
go test ./...
go run ./example/main.go
go run ./example/main.go https://petstore.swagger.io/v2/swagger.json
```

Or point at the bundle explicitly:

```bash
export SPECORA_EMBED_DIR=../../dist/embed/latest   # from packages/sdk-go
go run ./example/main.go ./openapi.yaml
```

### `decode embed manifest: invalid character '<'`

The CDN returned HTML (usually the SPA `index.html`) because `manifest.json` is not deployed yet. Use `EmbedDir` / `SPECORA_EMBED_DIR` with `dist/embed/latest`, or upload `dist/embed/` to your host at `/embed/`.

## Publishing releases (maintainers)

This module lives in the [specora](https://github.com/sahilkhaire/specora) monorepo. Tag the subdirectory:

```bash
git tag packages/sdk-go/v0.1.0
git push origin packages/sdk-go/v0.1.0
```

Users install with:

```bash
go get github.com/sahilkhaire/specora/packages/sdk-go@v0.1.0
```

## License

Apache-2.0 (same as the Specora project).
