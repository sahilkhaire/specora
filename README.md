# Specora

Specora is a modern open-source OpenAPI documentation platform with:

- Web UI for URL, paste, and upload based visualization
- CLI to replace script-based validate/serve/export workflows
- Shared core parsing and normalization engine

## UI Preview

Screenshots use the official [Swagger Petstore](https://petstore.swagger.io/) spec (`https://petstore.swagger.io/v2/swagger.json`). A copy of that spec lives in [`docs/fixtures/petstore.swagger.json`](docs/fixtures/petstore.swagger.json) for demos and docs.

### API client workbench

Browse endpoints by tag, send requests, and inspect responses — collections, try-out, schema reference, and saved exchanges in one view.

![Specora API client with Swagger Petstore](docs/images/ui-overview.png)

### Try it out

Configure path/query params (enabled per row), headers, body, and environment auth, then send requests against your base URL.

![Try it out panel](docs/images/ui-tryout.png)

### Live response viewer

JSON responses are searchable, collapsible, and syntax-colored. Save request/response pairs per endpoint for reuse later.

![JSON response viewer with search and expand/collapse](docs/images/ui-response-viewer.png)

### Request + response

Split request editor and response panel in the embedded API client workbench.

![Try it out with live JSON response](docs/images/ui-tryout-response.png)

### Schema reference

Operation insight panel shows parameters, payload templates, and response structure from the OpenAPI definition. Toggle the schema panel from the header or collection sidebar.

![Schema and response reference](docs/images/ui-schemas.png)

To regenerate these screenshots locally (requires the web dev server on port 5173):

```bash
npm run dev:web
# in another terminal:
npm run screenshots:readme
```

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Run web app:

```bash
npm run dev:web
```

3. Run CLI in watch mode:

```bash
npm run dev:cli
```

4. Build all workspaces:

```bash
npm run build
```

## CLI Usage

Validate a local spec:

```bash
npx specora validate ./openapi.yaml
```

Validate with machine-readable JSON output:

```bash
npx specora validate ./openapi.yaml --format json
```

Serve a local preview:

```bash
npx specora serve ./openapi.yaml --port 4173
```

Export static HTML preview:

```bash
npx specora export ./openapi.yaml --output ./dist/specora-preview.html
```

Export with machine-readable JSON output:

```bash
npx specora export ./openapi.yaml --output ./dist/specora-preview.html --format json
```

Run local proxy for browser try-out when the target API has no CORS headers:

```bash
npx specora proxy --port 8787
```

In the web UI Try Out section, enable **Proxy** and set the URL to `http://localhost:8787/proxy`. Try-out defaults to direct mode (browser → target API); the local CLI proxy is the only CORS bypass on hosted SaaS — request data never passes through Specora's servers.

The proxy binds to `127.0.0.1` and only accepts browser requests from localhost and the hosted app (`https://specora.varcore.dev`), so other websites you visit cannot use it to reach your local network. If you self-host the web UI elsewhere, allow its origin explicitly:

```bash
npx specora proxy --port 8787 --allow-origin https://docs.example.com
```

## Workspace Layout

- `apps/web`: React + Vite frontend
	- `src/app`: application composition and top-level screens
	- `src/features`: feature modules (spec parsing, try-out, etc.)
	- `src/shared`: shared styles and common UI helpers
- `apps/api`: optional Hono + SQLite backend (accounts and sync, published docs, admin, self-hosted try-out proxy)
	- `src/routes`: HTTP routes; `src/services`: shared domain logic
	- `src/http`: errors, validation, rate limiting, SSRF-safe outbound fetch
	- `src/db`: schema and versioned migrations (`PRAGMA user_version`)
- `packages/core`: shared OpenAPI parsing and normalization
	- `src/parsing`: parsing and validation pipeline
	- `src/summarization`: summary and metadata extraction
	- `src/types`: shared public contract types
- `packages/cli`: command-line workflow tool
	- `src/app`: CLI orchestration entry logic
	- `src/commands`: command-level modules
	- `src/server`: local proxy and serve server modules
	- `src/utils`: reusable CLI helpers
- `plan`: enterprise planning and governance docs

## Codebase Conventions

1. Keep business/domain logic inside feature or package modules, not in entry files.
2. Keep public APIs stable through package root exports.
3. Keep tests close to relevant module boundaries (`tests` or feature-level test files).
4. Keep `main` and `index` files thin and orchestration-only.

## Testing

Run all checks (lint, architecture boundaries, tests, build) from a clean clone:

```bash
npm run check
```

Run web-proxy contract smoke checks:

```bash
npm run smoke:proxy-contract
```

## Production

The hosted app is available at **[https://specora.varcore.dev](https://specora.varcore.dev)**.

Production builds use `apps/web/.env.production` (embed CDN, platform docs domain). After a web release, upload the embed bundle to `https://specora.varcore.dev/embed/`:

```bash
npm run publish:embed-cdn
# then sync dist/embed/ to your static host under /embed/
```

## Self-hosting

`docker compose up --build` runs the web UI on `http://localhost:5173` and the API on `http://localhost:8788`. Web settings are compiled in at build time (`VITE_*` build args); API settings are read from the environment at startup.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `file:./specora.db` | SQLite file. Migrations run automatically on start. |
| `CORS_ORIGIN` | hosted app + `http://localhost:5173` | Comma-separated browser origins allowed to call the API with cookies. |
| `COOKIE_SECURE` | `true` when `NODE_ENV=production` | Set `false` only for plain-HTTP intranet installs. |
| `COOKIE_DOMAIN` | unset | Share the session cookie across subdomains. |
| `SPECORA_ADMIN_PASSWORD` | unset | Enables `/admin/*`. Admin is disabled without it; there is no default password. |
| `PROXY_ENABLED` | `false` | Enables `POST /proxy` for server-side try-out. |
| `PROXY_ALLOW_PRIVATE_NETWORKS` | `false` | Allow the proxy and admin spec refresh to reach private/loopback addresses. |
| `PLATFORM_DOCS_DOMAIN` | `docs.varcore.dev` | Parent domain for published docs (`<slug>.<domain>`). |
| `PUBLISH_AUTO_VERIFY_CUSTOM_DOMAINS` | `false` | Serve custom domains without verification (single-tenant installs only). |
| `TRUST_PROXY` | `false` | Use `X-Forwarded-For` for rate limiting when behind a trusted reverse proxy. |
| `SPECORA_MAX_BODY_BYTES` | 20 MB | Request body limit (specs are stored inline). |

Security notes for operators:

- Passwords are hashed with scrypt; session and admin tokens are stored only as SHA-256 hashes.
- Sign-in endpoints are rate limited per IP in process memory. Put a shared limiter in front of multi-instance deployments.
- The try-out proxy re-validates the resolved IP of every connection and redirect, so DNS names pointing at private ranges or cloud metadata (`169.254.169.254`) are refused unless `PROXY_ALLOW_PRIVATE_NETWORKS=true`.

## Cloudflare Pages Deployment

This repository includes a GitHub Actions pipeline at `.github/workflows/deploy-web-cloudflare-pages.yml` to publish `apps/web` to Cloudflare Pages.

- Push to `main` deploys production.
- Pull requests deploy preview builds.
- You can also trigger it manually via `workflow_dispatch`.

### Required GitHub Secrets

Configure these repository secrets before running the deploy workflow:

- `CLOUDFLARE_API_TOKEN` (Cloudflare API token with Pages edit permissions)
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT_NAME` (existing Pages project name)

## Planning Documents

The `plan` folder contains the 6-8 week delivery plan, backlog, architecture, testing strategy, and release governance docs used to guide implementation.
