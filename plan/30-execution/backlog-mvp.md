# MVP Backlog

## Priority P0
1. As a developer, I can load an OpenAPI spec from URL so that I can inspect APIs quickly.
Acceptance Criteria:
- URL fetch errors are visible and actionable.
- Valid response parses and renders summary.

2. As a developer, I can paste JSON/YAML spec text and parse it.
Acceptance Criteria:
- JSON and YAML both supported.
- Validation errors include a clear message.

3. As a developer, I can upload a local spec file.
Acceptance Criteria:
- `.json`, `.yaml`, `.yml` accepted.
- File load updates operation list.

4. As a developer, I can browse operations and summaries.
Acceptance Criteria:
- Method + path visible.
- Summary shown when available.

5. As a developer, I can validate specs in CI via CLI.
Acceptance Criteria:
- Non-zero exit on invalid spec.
- Human-readable summary on success.

## Priority P1
1. As a developer, I can export a static HTML preview from CLI.
Acceptance Criteria:
- Output path option works.
- Output file opens in browser.

2. As a developer, I can serve a local preview.
Acceptance Criteria:
- Port option works.
- Preview shows summary and raw spec.

3. As a developer, I can search/filter operations in web UI.
Acceptance Criteria:
- Search by method/path/summary text.
- Empty state shown for no matches.

## Priority P2
1. As a developer, I can run basic try-out requests from web app.
Acceptance Criteria:
- Request body and headers configurable.
- Response status and payload visible.

2. As a maintainer, I can onboard contributors through docs.
Acceptance Criteria:
- Setup guide verified by new environment run.

## Next Iteration Backlog (Post-v0.1.0)

## Priority N0
1. N0-1 As a developer, I can rename a workspace without losing linked environments/spec data.
Acceptance Criteria:
- Rename updates workspace metadata and preserves workspace ID relations.
- Rename flow validates empty/duplicate names with clear user feedback.

2. N0-2 As a developer, I receive actionable errors when try-out fails due to network, CORS, auth, or proxy issues.
Acceptance Criteria:
- Error states map to clear recovery actions.
- Coverage includes timeout, unreachable host, and CORS-protected endpoints.

3. N0-3 As a maintainer, proxy and try-out integration paths are validated in automated tests.
Acceptance Criteria:
- Integration tests cover successful request, upstream failure, and proxy unavailability.
- Deterministic exit behavior asserted for CLI proxy error scenarios.

## Priority N1
1. N1-1 As a developer, large specs remain responsive while browsing operations.
Acceptance Criteria:
- Operation list and detail rendering are optimized for large fixture sizes.
- Benchmark shows p95 first render improvement against v0.1.0 baseline.

2. N1-2 As a maintainer, I can perform a clean-machine contributor setup without manual fixes.
Acceptance Criteria:
- Setup docs are dry-run validated on a fresh environment.
- Any setup friction is documented and resolved.

## Priority N2
1. N2-1 As a maintainer, I can export and import workspace metadata for backup/migration.
Acceptance Criteria:
- Export produces deterministic JSON payload.
- Import validates schema and handles conflicts safely.

## Iteration 4 Closeout Snapshot (2026-05-28)
1. Completed N0 items:
   - `N0-1`, `N0-1b`, `N0-1c`, `N0-2`, `N0-3`, `N0-3b`
2. Completed N1 items:
   - `N1-1`, `N1-2`
3. Remaining next-iteration candidate:
   - `N2-1` (deferred; outside reliability/performance stabilization scope)
