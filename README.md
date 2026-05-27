# Specora

Specora is a modern open-source OpenAPI documentation platform with:

- Web UI for URL, paste, and upload based visualization
- CLI to replace script-based validate/serve/export workflows
- Shared core parsing and normalization engine

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

## Workspace Layout

- `apps/web`: React + Vite frontend
- `packages/core`: shared OpenAPI parsing and normalization
- `packages/cli`: command-line workflow tool
- `plan`: product and delivery planning docs

## Planning Documents

The `plan` folder contains the 6-8 week delivery plan, backlog, architecture, testing strategy, and release governance docs used to guide implementation.
