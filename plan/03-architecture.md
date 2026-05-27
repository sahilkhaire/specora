# Architecture

## Monorepo Layout
- `apps/web`: React + Vite documentation frontend
- `packages/core`: shared parsing/validation utilities
- `packages/cli`: script-replacement command-line interface
- `plan`: roadmap and delivery artifacts

## Architectural Principles
1. Shared core logic to avoid divergence between CLI and web.
2. Type-safe boundaries across packages.
3. Deterministic outputs for CI automation.
4. Fast local developer loop.

## Runtime Components
1. Core (`@specora/core`)
- Input normalization
- Parse JSON/YAML
- OpenAPI validation and summary extraction
- Error model with hints

2. CLI (`@specora/cli`)
- Command parsing
- File IO and output formatting
- Serve/export utilities for docs previews
- CI-friendly exit codes

3. Web (`@specora/web`)
- Spec load controls
- Operation browsing UI
- Try-out experience (current cycle baseline)
- Readability/performance UX improvements

## Data Flow
1. User provides spec source (URL, text, file).
2. Source is parsed into object model.
3. Validation returns either diagnostics or normalized spec.
4. Presentation layer renders summary + operations.
5. CLI optionally exports static HTML snapshot.

## Package Dependency Rules
1. `apps/web` can depend on shared utility packages that are browser-safe.
2. `packages/cli` can depend on `packages/core`.
3. `packages/core` must remain environment-conscious and avoid hard-coding UI/runtime assumptions.

## Future Extension Points
1. Dedicated browser-safe core adapter.
2. Advanced lint rule engine.
3. Version diff engine.
4. Optional local proxy server package.
