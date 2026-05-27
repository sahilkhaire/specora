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

## Workspace Layout

- `apps/web`: React + Vite frontend
- `packages/core`: shared OpenAPI parsing and normalization
- `packages/cli`: command-line workflow tool
- `plan`: product and delivery planning docs
